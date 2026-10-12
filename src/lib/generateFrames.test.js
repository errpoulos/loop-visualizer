import { describe, expect, it } from 'vitest'
import { generateFrames, MAX_FRAMES } from './generateFrames.js'

const loop = (v, dir, start, cmp, end) => ({ var: v, dir, start, cmp, end })
const values = (frames, v) => frames.map((f) => f.vars[v])

describe('generateFrames', () => {
  const arr = [10, 20, 30, 40]

  it('runs a forward exclusive loop', () => {
    const { frames, error } = generateFrames(arr, [loop('i', 'forward', '0', '<', 'n')])
    expect(error).toBeNull()
    expect(values(frames, 'i')).toEqual([0, 1, 2, 3])
  })

  it('runs a forward inclusive loop', () => {
    const { frames } = generateFrames(arr, [loop('i', 'forward', '0', '<=', 'n')])
    expect(values(frames, 'i')).toEqual([0, 1, 2, 3, 4])
  })

  it('runs a reverse loop', () => {
    const { frames } = generateFrames(arr, [loop('i', 'reverse', 'n - 1', '>=', '0')])
    expect(values(frames, 'i')).toEqual([3, 2, 1, 0])
  })

  it('supports inner bounds that reference outer vars', () => {
    const { frames } = generateFrames(arr, [
      loop('i', 'forward', '0', '<', 'n'),
      loop('j', 'forward', 'i + 1', '<', 'n'),
    ])
    const pairs = frames.filter((f) => f.level === 1 && f.event === 'iter')
    expect(pairs).toHaveLength((arr.length * (arr.length - 1)) / 2)
    expect(pairs[0].vars).toEqual({ i: 0, j: 1 })
    expect(pairs.at(-1).vars).toEqual({ i: 2, j: 3 })
  })

  it('emits a skip frame when an inner loop runs zero times', () => {
    const { frames } = generateFrames(arr, [
      loop('i', 'forward', '0', '<', 'n'),
      loop('j', 'forward', 'i + 1', '<', 'n'),
    ])
    const last = frames.at(-1)
    expect(last).toMatchObject({ level: 1, event: 'skip', vars: { i: 3 } })
  })

  it('supports three levels', () => {
    const { frames } = generateFrames(arr, [
      loop('i', 'forward', '0', '<', 'n'),
      loop('j', 'forward', 'i + 1', '<', 'n'),
      loop('k', 'forward', 'j + 1', '<', 'n'),
    ])
    const triples = frames.filter((f) => f.level === 2 && f.event === 'iter')
    expect(triples.map((f) => [f.vars.i, f.vars.j, f.vars.k])).toEqual([
      [0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3],
    ])
  })

  it('truncates runaway loops', () => {
    const { frames, truncated } = generateFrames(arr, [loop('i', 'reverse', '0', '<', 'n')])
    expect(truncated).toBe(true)
    expect(frames).toHaveLength(MAX_FRAMES)
  })

  it('reports expression errors', () => {
    const { frames, error } = generateFrames(arr, [loop('i', 'forward', 'j', '<', 'n')])
    expect(frames).toEqual([])
    expect(error).toBe('Loop i start: Unknown variable "j"')
  })
})
