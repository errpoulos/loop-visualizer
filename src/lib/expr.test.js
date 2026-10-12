import { describe, expect, it } from 'vitest'
import { evaluate } from './expr.js'

describe('evaluate', () => {
  it('handles precedence and parens', () => {
    expect(evaluate('1 + 2 * 3')).toBe(7)
    expect(evaluate('(1 + 2) * 3')).toBe(9)
    expect(evaluate('10 - 4 - 3')).toBe(3)
  })

  it('handles unary minus', () => {
    expect(evaluate('-1')).toBe(-1)
    expect(evaluate('n - -1', { n: 2 })).toBe(3)
  })

  it('uses integer division and modulo', () => {
    expect(evaluate('n / 2', { n: 7 })).toBe(3)
    expect(evaluate('n % 3', { n: 7 })).toBe(1)
  })

  it('resolves variables', () => {
    expect(evaluate('i + 1', { i: 4 })).toBe(5)
  })

  it('throws readable errors', () => {
    expect(() => evaluate('x + 1', { n: 1 })).toThrow('Unknown variable "x"')
    expect(() => evaluate('(1 + 2')).toThrow('Missing ")"')
    expect(() => evaluate('1 +')).toThrow('Unexpected end')
    expect(() => evaluate('1 2')).toThrow('Unexpected "2"')
    expect(() => evaluate('')).toThrow('empty')
    expect(() => evaluate('1 / 0')).toThrow('Division by zero')
  })
})
