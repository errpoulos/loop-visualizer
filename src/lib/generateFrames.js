import { evaluate } from './expr.js'

export const MAX_FRAMES = 5000
export const LOOP_VARS = ['i', 'j', 'k']

const COMPARATORS = {
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
}

export function defaultLoop(level, dir = 'forward') {
  const name = LOOP_VARS[level]
  const parent = LOOP_VARS[level - 1]
  if (dir === 'reverse') {
    return parent
      ? { var: name, dir, start: 'n - 1', cmp: '>', end: parent }
      : { var: name, dir, start: 'n - 1', cmp: '>=', end: '0' }
  }
  return { var: name, dir, start: parent ? `${parent} + 1` : '0', cmp: '<', end: 'n' }
}

// Simulates the nested loops and records a frame every time a loop variable takes a new value.
// A frame with event 'skip' marks an inner loop whose condition was false on entry (ran 0 times).
export function generateFrames(arr, loops) {
  const frames = []
  let truncated = false

  function run(level, vars, bounds) {
    if (level >= loops.length || truncated) return
    const loop = loops[level]
    const scope = { n: arr.length, ...vars }
    let start, end
    try {
      start = evaluate(loop.start, scope)
    } catch (err) {
      throw new Error(`Loop ${loop.var} start: ${err.message}`)
    }
    try {
      end = evaluate(loop.end, scope)
    } catch (err) {
      throw new Error(`Loop ${loop.var} end: ${err.message}`)
    }
    const nextBounds = [...bounds, { start, end }]
    const compare = COMPARATORS[loop.cmp]
    const stepBy = loop.dir === 'reverse' ? -1 : 1

    if (!compare(start, end)) {
      if (level > 0) {
        frames.push({ vars: { ...vars }, level, event: 'skip', bounds: nextBounds })
      }
      return
    }

    for (let value = start; compare(value, end); value += stepBy) {
      if (frames.length >= MAX_FRAMES) {
        truncated = true
        return
      }
      const nextVars = { ...vars, [loop.var]: value }
      frames.push({ vars: nextVars, level, event: 'iter', bounds: nextBounds })
      run(level + 1, nextVars, nextBounds)
      if (truncated) return
    }
  }

  try {
    run(0, {}, [])
  } catch (err) {
    return { frames: [], truncated: false, error: err.message }
  }
  return { frames, truncated, error: null }
}
