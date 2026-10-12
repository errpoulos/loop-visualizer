import { parseSource } from './instrument.js'

// Keeps the loop form and the code editor in sync. The "loop chain" is the first `for` loop in the
// code, then the first `for` loop nested inside it, and so on. Simple loops of the form
// `for (let v = START; v CMP END; v++ / v--)` are editable through the form; others are read-only.

export const MAX_FORM_LOOPS = 3
const VAR_CANDIDATES = ['i', 'j', 'k', 'l', 'm', 'p', 'q']
const CMPS = { forward: ['<', '<='], reverse: ['>', '>='] }

export const DEFAULT_CODE = `const n = arr.length;
for (let i = 0; i < n; i++) {
  for (let j = i + 1; j < n; j++) {
    // your code here
  }
}
`

function findFor(node, skipSelf) {
  if (!node || typeof node !== 'object') return null
  if (!skipSelf && node.type === 'ForStatement') return node
  if (/Function/.test(node.type)) return null
  for (const key of Object.keys(node)) {
    if (key === 'loc') continue
    const value = node[key]
    const children = Array.isArray(value) ? value : [value]
    for (const child of children) {
      if (child?.type) {
        const found = findFor(child, false)
        if (found) return found
      }
    }
  }
  return null
}

function describeLoop(node, source) {
  const { init, test, update } = node
  const text = (n) => source.slice(n.start, n.end)
  const decl = init?.type === 'VariableDeclaration' && init.declarations.length === 1 ? init.declarations[0] : null
  const name = decl?.id.type === 'Identifier' ? decl.id.name : null
  const base = { node, var: name, header: source.slice(node.start, node.body.start).trim() }
  if (!name || !decl.init) return { ...base, simple: false }

  const updatesVar = (arg) => arg?.type === 'Identifier' && arg.name === name
  let dir = null
  if (update?.type === 'UpdateExpression' && updatesVar(update.argument)) {
    dir = update.operator === '++' ? 'forward' : 'reverse'
  } else if (update?.type === 'AssignmentExpression' && updatesVar(update.left) && text(update.right) === '1') {
    dir = update.operator === '+=' ? 'forward' : update.operator === '-=' ? 'reverse' : null
  }
  const cmpOk = test?.type === 'BinaryExpression' && test.left.type === 'Identifier' && test.left.name === name
  if (!dir || !cmpOk || !CMPS[dir].includes(test.operator)) return { ...base, simple: false }

  return {
    ...base,
    simple: true,
    kind: init.kind,
    dir,
    start: text(decl.init),
    cmp: test.operator,
    end: text(test.right),
  }
}

export function parseLoopChain(source) {
  let ast
  try {
    ast = parseSource(source)
  } catch {
    return null
  }
  const chain = []
  let node = findFor(ast, false)
  while (node) {
    chain.push(describeLoop(node, source))
    node = findFor(node.body, false)
  }
  return chain
}

const replaceRange = (source, start, end, text) => source.slice(0, start) + text + source.slice(end)

const lineStart = (source, pos) => source.lastIndexOf('\n', pos - 1) + 1

const indentAt = (source, pos) => source.slice(lineStart(source, pos), pos).match(/^\s*/)[0]

const header = ({ kind = 'let', var: v, start, cmp, end, dir }) =>
  `${kind} ${v} = ${start}; ${v} ${cmp} ${end}; ${v}${dir === 'reverse' ? '--' : '++'}`

export function defaultLoopFields(varName, parentVar, dir = 'forward') {
  if (dir === 'reverse') {
    return parentVar
      ? { var: varName, dir, start: 'n - 1', cmp: '>', end: parentVar }
      : { var: varName, dir, start: 'n - 1', cmp: '>=', end: '0' }
  }
  return { var: varName, dir, start: parentVar ? `${parentVar} + 1` : '0', cmp: '<', end: 'n' }
}

// Rewrites the header of loop `index` in the chain with `patch` merged in.
export function updateLoop(source, index, patch) {
  const loop = parseLoopChain(source)?.[index]
  if (!loop?.simple) return source
  const next = { ...loop, ...patch }
  if (!CMPS[next.dir].includes(next.cmp)) next.cmp = CMPS[next.dir][0]
  const { init, update } = loop.node
  return replaceRange(source, init.start, update.end, header(next))
}

export function setDirection(source, index, dir) {
  const chain = parseLoopChain(source)
  const loop = chain?.[index]
  if (!loop?.simple) return source
  return updateLoop(source, index, defaultLoopFields(loop.var, chain[index - 1]?.var, dir))
}

const reindent = (lines, delta) =>
  lines.map((line) => {
    if (line.trim() === '') return ''
    return delta > 0 ? ' '.repeat(delta) + line : line.replace(new RegExp(`^ {0,${-delta}}`), '')
  })

const bodyLines = (source, block) =>
  source.slice(block.start + 1, block.end - 1).replace(/^[ \t]*\n/, '').replace(/\n[ \t]*$/, '').split('\n')

// Wraps the body of the innermost chain loop in a new loop (or appends a first loop).
export function addInnerLoop(source) {
  const chain = parseLoopChain(source)
  if (!chain) return source
  const used = new Set(chain.map((l) => l.var))
  const name = VAR_CANDIDATES.find((v) => !used.has(v) && !new RegExp(`\\b${v}\\b`).test(source)) ??
    VAR_CANDIDATES.find((v) => !used.has(v))
  const fields = defaultLoopFields(name, chain.at(-1)?.var)

  if (chain.length === 0) {
    const sep = source.endsWith('\n') || source === '' ? '' : '\n'
    return `${source}${sep}for (${header(fields)}) {\n  // your code here\n}\n`
  }

  const outer = chain.at(-1).node
  const body = outer.body
  if (body.type !== 'BlockStatement') return source
  const indent = indentAt(source, outer.start)
  const inner = `${indent}  `
  const lines = bodyLines(source, body)
  const content = lines.every((l) => l.trim() === '') ? [`${inner}    // your code here`] : reindent(lines, 2)
  const block = `{\n${inner}for (${header(fields)}) {\n${content.join('\n')}\n${inner}}\n${indent}}`
  return replaceRange(source, body.start, body.end, block)
}

// Removes the innermost chain loop, keeping its body in place.
export function removeInnerLoop(source) {
  const chain = parseLoopChain(source)
  if (!chain || chain.length < 2) return source
  const loop = chain.at(-1).node
  const body = loop.body
  const startOfLine = lineStart(source, loop.start)
  const onOwnLine = source.slice(startOfLine, loop.start).trim() === ''
  const start = onOwnLine ? startOfLine : loop.start
  const lines = body.type === 'BlockStatement'
    ? reindent(bodyLines(source, body), -2)
    : [indentAt(source, loop.start) + source.slice(body.start, body.end)]
  if (lines.every((l) => l.trim() === '')) {
    const end = source[loop.end] === '\n' && onOwnLine ? loop.end + 1 : loop.end
    return replaceRange(source, start, end, '')
  }
  return replaceRange(source, start, loop.end, lines.join('\n'))
}
