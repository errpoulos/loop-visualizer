import { parse } from 'acorn'

// Rewrites user code so every statement and every loop iteration reports a snapshot of the
// variables in scope. Only inserts text (never reformats), so line numbers stay meaningful.
//
//   __s(id, vars)   before a statement
//   __en(id)        before a loop starts
//   __it(id, vars)  at the top of each loop iteration
//   __ex(id, vars)  after a loop finishes (lets us notice loops that ran 0 times)
//   __v(() => x)    reads a variable, tolerating the temporal dead zone
//   __c(id, test)   records an if/ternary condition's result and returns it unchanged
//   __o(x)          records one operand of a comparison inside a condition, returns it unchanged

const LOOP_TYPES = new Set(['ForStatement', 'WhileStatement', 'DoWhileStatement', 'ForInStatement', 'ForOfStatement'])
const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])
const SKIP_KEYS = new Set(['type', 'start', 'end', 'loc'])

export const INPUT_NAME = 'arr'
export const RUNTIME_NAMES = ['__s', '__it', '__en', '__ex', '__v', '__c', '__o']

export function parseSource(source) {
  return parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'script',
    allowReturnOutsideFunction: true,
    locations: true,
  })
}

export function patternNames(pattern, out = []) {
  if (!pattern) return out
  switch (pattern.type) {
    case 'Identifier':
      out.push(pattern.name)
      break
    case 'ObjectPattern':
      pattern.properties.forEach((p) => patternNames(p.type === 'RestElement' ? p.argument : p.value, out))
      break
    case 'ArrayPattern':
      pattern.elements.forEach((el) => patternNames(el, out))
      break
    case 'AssignmentPattern':
      patternNames(pattern.left, out)
      break
    case 'RestElement':
      patternNames(pattern.argument, out)
      break
  }
  return out
}

function loopVarName(loop) {
  if (loop.type === 'ForStatement') {
    const { init } = loop
    if (init?.type === 'VariableDeclaration' && init.declarations[0]?.id.type === 'Identifier') {
      return init.declarations[0].id.name
    }
    if (init?.type === 'AssignmentExpression' && init.left.type === 'Identifier') return init.left.name
    return null
  }
  if (loop.type === 'ForInStatement' || loop.type === 'ForOfStatement') {
    const names = loop.left.type === 'VariableDeclaration'
      ? patternNames(loop.left.declarations[0].id)
      : patternNames(loop.left)
    return names[0] ?? null
  }
  return null
}

export function instrument(source) {
  const ast = parseSource(source)
  const inserts = []
  const statements = []
  const loops = []
  const pointerVars = []
  const conditions = []
  let seq = 0
  let depth = 0

  // `depth` is how deeply nested the construct owning this text is, so text belonging to an inner
  // construct lands inside text belonging to an outer one at the same position.
  const insert = (pos, text, close = false) => inserts.push({ pos, text, close, depth, seq: seq++ })
  const addPointer = (name) => {
    if (name && !pointerVars.includes(name)) pointerVars.push(name)
  }

  const snapshot = (frames) => {
    const seen = new Set()
    const parts = []
    for (let f = frames.length - 1; f >= 0; f--) {
      for (const name of frames[f].names) {
        if (seen.has(name) || name.startsWith('__')) continue
        seen.add(name)
        parts.push(`${JSON.stringify(name)}:__v(()=>${name})`)
      }
    }
    return `{${parts.join(',')}}`
  }

  const nearestFunctionFrame = (frames) => {
    for (let f = frames.length - 1; f >= 0; f--) if (frames[f].isFunction) return frames[f]
    return frames[0]
  }

  const declare = (decl, frames) => {
    if (decl.type === 'VariableDeclaration') {
      const target = decl.kind === 'var' ? nearestFunctionFrame(frames) : frames.at(-1)
      decl.declarations.forEach((d) => target.names.push(...patternNames(d.id)))
    } else if (decl.type === 'ClassDeclaration' && decl.id) {
      frames.at(-1).names.push(decl.id.name)
    }
  }

  function visitChildren(node, ctx) {
    if (node.type === 'MemberExpression' && node.computed && node.property.type === 'Identifier') {
      addPointer(node.property.name)
    }
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue
      const value = node[key]
      if (Array.isArray(value)) value.forEach((child) => child?.type && visit(child, ctx))
      else if (value?.type) visit(value, ctx)
    }
  }

  // The line a branch "goes to": the first statement inside a block, else the branch itself.
  const branchLine = (node) =>
    (node.type === 'BlockStatement' ? node.body[0] ?? node : node).loc.start.line

  // Wraps a condition as __c(id, test). A non-logical binary test (`a > b`) also gets its operands
  // wrapped as __o(a) > __o(b), which evaluates exactly as before but lets us show `5 > 4`.
  function wrapCondition(test, ctx, meta) {
    const id = conditions.push({
      line: test.loc.start.line,
      text: source.slice(test.start, test.end),
      operator: test.type === 'BinaryExpression' ? test.operator : null,
      ...meta,
    }) - 1
    depth++
    insert(test.start, `__c(${id},`)
    insert(test.end, ')', true)
    if (test.type === 'BinaryExpression') {
      depth++
      for (const side of [test.left, test.right]) {
        insert(side.start, '__o(')
        insert(side.end, ')', true)
      }
      visit(test.left, ctx)
      visit(test.right, ctx)
      depth--
    } else {
      visit(test, ctx)
    }
    depth--
  }

  // Dispatches on node type. Statements reached here sit in a non-block position (if/else branch,
  // labeled body), so they get wrapped in braces when instrumented.
  function visit(node, ctx) {
    if (FUNCTION_TYPES.has(node.type)) return visitFunction(node, ctx)
    if (node.type === 'BlockStatement' || node.type === 'StaticBlock') {
      return visitBlockList(node.body, ctx, { names: [], isFunction: false })
    }
    if (node.type === 'SwitchStatement') {
      visit(node.discriminant, ctx)
      const frame = { names: [], isFunction: false }
      node.cases.forEach((c) => {
        if (c.test) visit(c.test, ctx)
        visitBlockList(c.consequent, ctx, frame)
      })
      return
    }
    if (node.type === 'ConditionalExpression') {
      wrapCondition(node.test, ctx, {
        kind: 'ternary',
        thenLine: branchLine(node.consequent),
        elseLine: branchLine(node.alternate),
      })
      visit(node.consequent, ctx)
      visit(node.alternate, ctx)
      return
    }
    if (node.type === 'CatchClause') {
      const frames = [...ctx.frames, { names: patternNames(node.param), isFunction: false }]
      return visit(node.body, { ...ctx, frames })
    }
    if (/Statement$|Declaration$/.test(node.type) && node.type !== 'VariableDeclaration') {
      return instrumentStatement(node, ctx, false)
    }
    visitChildren(node, ctx)
  }

  function visitFunction(fn, ctx) {
    const names = fn.params.flatMap((p) => patternNames(p))
    if (fn.type === 'FunctionExpression' && fn.id) names.push(fn.id.name)
    const fnCtx = { frames: [...ctx.frames, { names, isFunction: true }], loopDepth: 0 }
    fn.params.forEach((p) => visitChildren(p, fnCtx))
    if (fn.body.type === 'BlockStatement') visitBlockList(fn.body.body, fnCtx, { names: [], isFunction: false })
    else visit(fn.body, fnCtx)
  }

  function visitBlockList(statementList, ctx, frame) {
    const blockCtx = { ...ctx, frames: [...ctx.frames, frame] }
    statementList.forEach((s) => {
      if (s.type === 'FunctionDeclaration') frame.names.push(s.id.name)
    })
    statementList.forEach((s) => {
      instrumentStatement(s, blockCtx, true)
      declare(s, blockCtx.frames)
    })
  }

  function instrumentStatement(stmt, ctx, inBlockList) {
    if (stmt.type === 'BlockStatement') return visit(stmt, ctx)
    if (stmt.type === 'EmptyStatement') return
    if (stmt.type === 'FunctionDeclaration') return visitFunction(stmt, ctx)
    if (stmt.type === 'ClassDeclaration') return visitChildren(stmt, ctx)

    let loop = stmt
    while (loop.type === 'LabeledStatement') loop = loop.body
    if (!LOOP_TYPES.has(loop.type)) loop = null
    if (stmt.type === 'LabeledStatement' && !loop) return instrumentStatement(stmt.body, ctx, false)

    depth++
    const snap = snapshot(ctx.frames)
    const id = statements.push({ line: stmt.loc.start.line }) - 1
    const wrap = !inBlockList
    let open = `${wrap ? '{' : ''};__s(${id},${snap});`
    let close = wrap ? '}' : ''

    if (loop) {
      const loopId = visitLoop(loop, ctx)
      open += `__en(${loopId});`
      close = `;__ex(${loopId},${snap});${close}`
    } else if (stmt.type === 'IfStatement') {
      wrapCondition(stmt.test, ctx, {
        kind: 'if',
        thenLine: branchLine(stmt.consequent),
        elseLine: stmt.alternate ? branchLine(stmt.alternate) : null,
        elseIsIf: stmt.alternate?.type === 'IfStatement',
      })
      visit(stmt.consequent, ctx)
      if (stmt.alternate) visit(stmt.alternate, ctx)
    } else {
      visitChildren(stmt, ctx)
    }

    insert(stmt.start, open)
    if (close) insert(stmt.end, close, true)
    depth--
  }

  function visitLoop(loop, ctx) {
    const loopFrame = { names: [], isFunction: false }
    const header = loop.type === 'ForStatement' ? loop.init : loop.left
    if (header?.type === 'VariableDeclaration') {
      const target = header.kind === 'var' ? nearestFunctionFrame(ctx.frames) : loopFrame
      header.declarations.forEach((d) => target.names.push(...patternNames(d.id)))
    }
    const loopCtx = { frames: [...ctx.frames, loopFrame], loopDepth: ctx.loopDepth + 1 }
    const varName = loopVarName(loop)
    if (loop.type === 'ForStatement') addPointer(varName)

    const id = loops.push({ line: loop.loc.start.line, level: ctx.loopDepth, var: varName, type: loop.type }) - 1

    for (const key of ['init', 'test', 'update', 'left', 'right']) {
      if (loop[key]) visit(loop[key], loopCtx)
    }

    const { body } = loop
    const iterate = `__it(${id},${snapshot(loopCtx.frames)});`
    if (body.type === 'BlockStatement') {
      insert(body.start + 1, iterate)
      visitBlockList(body.body, loopCtx, { names: [], isFunction: false })
    } else {
      insert(body.start, `{${iterate}`)
      insert(body.end, '}', true)
      instrumentStatement(body, loopCtx, true)
    }
    return id
  }

  visitBlockList(ast.body, { frames: [], loopDepth: 0 }, { names: [INPUT_NAME], isFunction: true })

  // At one position, closing text goes first (innermost first), then opening text (outermost first).
  inserts.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos
    if (a.close !== b.close) return a.close ? -1 : 1
    if (a.depth !== b.depth) return a.close ? b.depth - a.depth : a.depth - b.depth
    return a.seq - b.seq
  })

  let code = ''
  let last = 0
  for (const { pos, text } of inserts) {
    code += source.slice(last, pos) + text
    last = pos
  }
  code += source.slice(last)

  return { code: `"use strict";${code}`, statements, loops, pointerVars, conditions }
}
