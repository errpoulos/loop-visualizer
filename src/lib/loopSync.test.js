import { describe, expect, it } from 'vitest'
import { addInnerLoop, DEFAULT_CODE, parseLoopChain, removeInnerLoop, setDirection, updateLoop } from './loopSync.js'

describe('parseLoopChain', () => {
  it('reads the nested for-loop chain', () => {
    const chain = parseLoopChain(DEFAULT_CODE)
    expect(chain.map(({ var: v, dir, start, cmp, end, simple }) => ({ v, dir, start, cmp, end, simple }))).toEqual([
      { v: 'i', dir: 'forward', start: '0', cmp: '<', end: 'n', simple: true },
      { v: 'j', dir: 'forward', start: 'i + 1', cmp: '<', end: 'n', simple: true },
    ])
  })

  it('marks complex loops as not simple', () => {
    const chain = parseLoopChain('for (let i = 0, j = 5; i < j; i++, j--) {}')
    expect(chain).toHaveLength(1)
    expect(chain[0]).toMatchObject({ simple: false, header: 'for (let i = 0, j = 5; i < j; i++, j--)' })
  })

  it('accepts += 1 / -= 1 updates', () => {
    expect(parseLoopChain('for (let i = 9; i >= 0; i -= 1) {}')[0]).toMatchObject({ simple: true, dir: 'reverse' })
  })

  it('returns null on syntax errors', () => {
    expect(parseLoopChain('for (')).toBeNull()
  })
})

describe('editing', () => {
  it('rewrites just the loop header', () => {
    const next = updateLoop(DEFAULT_CODE, 1, { end: 'n - 1', cmp: '<=' })
    expect(next).toContain('for (let j = i + 1; j <= n - 1; j++) {')
    expect(next).toContain('// your code here')
  })

  it('switches direction with defaults', () => {
    expect(setDirection(DEFAULT_CODE, 1, 'reverse')).toContain('for (let j = n - 1; j > i; j--) {')
    expect(setDirection(DEFAULT_CODE, 0, 'reverse')).toContain('for (let i = n - 1; i >= 0; i--) {')
  })

  it('adds a nested loop around the innermost body', () => {
    expect(addInnerLoop(DEFAULT_CODE)).toBe(`const n = arr.length;
for (let i = 0; i < n; i++) {
  for (let j = i + 1; j < n; j++) {
    for (let k = j + 1; k < n; k++) {
      // your code here
    }
  }
}
`)
  })

  it('removes the innermost loop and keeps its body', () => {
    expect(removeInnerLoop(addInnerLoop(DEFAULT_CODE))).toBe(DEFAULT_CODE)
    expect(removeInnerLoop(DEFAULT_CODE)).toBe(`const n = arr.length;
for (let i = 0; i < n; i++) {
  // your code here
}
`)
  })

  it('adds a first loop when there is none', () => {
    expect(addInnerLoop('const n = arr.length;')).toBe(
      'const n = arr.length;\nfor (let i = 0; i < n; i++) {\n  // your code here\n}\n',
    )
  })
})
