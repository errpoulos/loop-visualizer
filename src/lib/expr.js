// Tiny safe integer expression evaluator: numbers, identifiers, + - * / %, unary minus, parens.
// `/` is integer division (truncated), matching how index math is usually written.

function tokenize(source) {
  const tokens = []
  let pos = 0
  while (pos < source.length) {
    const ch = source[pos]
    if (/\s/.test(ch)) {
      pos++
    } else if (/\d/.test(ch)) {
      let end = pos
      while (end < source.length && /\d/.test(source[end])) end++
      tokens.push({ type: 'num', value: Number(source.slice(pos, end)) })
      pos = end
    } else if (/[A-Za-z_]/.test(ch)) {
      let end = pos
      while (end < source.length && /\w/.test(source[end])) end++
      tokens.push({ type: 'id', value: source.slice(pos, end) })
      pos = end
    } else if ('+-*/%()'.includes(ch)) {
      tokens.push({ type: 'op', value: ch })
      pos++
    } else {
      throw new Error(`Unexpected character "${ch}"`)
    }
  }
  return tokens
}

export function evaluate(source, scope = {}) {
  const tokens = tokenize(String(source))
  if (tokens.length === 0) throw new Error('Expression is empty')
  let index = 0

  const peek = () => tokens[index]
  const isOp = (value) => peek()?.type === 'op' && peek().value === value

  function parseSum() {
    let value = parseProduct()
    while (isOp('+') || isOp('-')) {
      const op = tokens[index++].value
      const right = parseProduct()
      value = op === '+' ? value + right : value - right
    }
    return value
  }

  function parseProduct() {
    let value = parseUnary()
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = tokens[index++].value
      const right = parseUnary()
      if (op === '*') value *= right
      else if (right === 0) throw new Error('Division by zero')
      else if (op === '/') value = Math.trunc(value / right)
      else value %= right
    }
    return value
  }

  function parseUnary() {
    if (isOp('-')) {
      index++
      return -parseUnary()
    }
    if (isOp('+')) {
      index++
      return parseUnary()
    }
    return parseAtom()
  }

  function parseAtom() {
    const token = tokens[index++]
    if (!token) throw new Error('Unexpected end of expression')
    if (token.type === 'num') return token.value
    if (token.type === 'id') {
      if (!(token.value in scope)) throw new Error(`Unknown variable "${token.value}"`)
      return scope[token.value]
    }
    if (token.value === '(') {
      const value = parseSum()
      if (!isOp(')')) throw new Error('Missing ")"')
      index++
      return value
    }
    throw new Error(`Unexpected "${token.value}"`)
  }

  const result = parseSum()
  if (index < tokens.length) throw new Error(`Unexpected "${tokens[index].value}"`)
  return result
}
