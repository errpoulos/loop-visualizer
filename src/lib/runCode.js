import { INPUT_NAME, instrument, RUNTIME_NAMES } from './instrument.js'

export const MAX_STEPS = 10000

const STEP_LIMIT = Symbol('step limit')
const UNINITIALIZED = Symbol('uninitialized')

function freeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return typeof value === 'function' ? '[function]' : value
  if (seen.has(value)) return '[circular]'
  seen.add(value)
  if (Array.isArray(value)) return value.map((v) => freeze(v, seen))
  if (value instanceof Map) return { '[Map]': [...value].map(([k, v]) => [freeze(k, seen), freeze(v, seen)]) }
  if (value instanceof Set) return { '[Set]': [...value].map((v) => freeze(v, seen)) }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, freeze(v, seen)]))
}

function freezeVars(vars) {
  const out = {}
  for (const [name, value] of Object.entries(vars)) {
    if (value !== UNINITIALIZED && typeof value !== 'function') out[name] = freeze(value)
  }
  return out
}

export function formatValue(value) {
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value !== 'object' || value === null) return String(value)
  if (value['[Map]']) return `Map(${value['[Map]'].map(([k, v]) => `${formatValue(k)} => ${formatValue(v)}`).join(', ')})`
  if (value['[Set]']) return `Set(${value['[Set]'].map(formatValue).join(', ')})`
  if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`
  return `{${Object.entries(value).map(([k, v]) => `${k}: ${formatValue(v)}`).join(', ')}}`
}

// Runs the user's code against a copy of `arr` and records one frame per statement / loop iteration.
// Frame kinds: 'stmt' (about to run a statement), 'iter' (loop iteration began), 'skip' (loop ran 0 times).
export function runCode(source, arr) {
  let program
  try {
    program = instrument(source)
  } catch (err) {
    return {
      frames: [], logs: [], loops: [], pointerVars: [], conditions: [], branches: [], truncated: false, returned: undefined,
      error: { kind: 'syntax', message: err.message.replace(/ \(\d+:\d+\)$/, ''), line: err.loc?.line ?? null },
    }
  }

  const { statements, loops, pointerVars, conditions } = program
  const frames = []
  const logs = []
  // Each evaluated if/ternary condition, tagged with the frame that was running when it happened.
  const branches = []
  const operands = []
  const iterations = new Map()

  const record = (frame) => {
    if (frames.length >= MAX_STEPS) throw STEP_LIMIT
    frames.push(frame)
  }

  const runtime = {
    __s: (id, vars) => record({ kind: 'stmt', line: statements[id].line, vars: freezeVars(vars) }),
    __en: (id) => iterations.set(id, 0),
    __it: (id, vars) => {
      iterations.set(id, (iterations.get(id) ?? 0) + 1)
      record({ kind: 'iter', line: loops[id].line, loopId: id, level: loops[id].level, vars: freezeVars(vars) })
    },
    __ex: (id, vars) => {
      if (iterations.get(id) === 0) {
        record({ kind: 'skip', line: loops[id].line, loopId: id, level: loops[id].level, vars: freezeVars(vars) })
      }
    },
    __o: (value) => {
      operands.push(value)
      return value
    },
    __c: (id, value) => {
      const pair = conditions[id].operator ? operands.splice(-2) : null
      branches.push({
        cond: id,
        frame: frames.length - 1,
        taken: Boolean(value),
        value: freeze(value),
        operands: pair?.length === 2 ? pair.map((v) => freeze(v)) : null,
      })
      return value
    },
    __v: (read) => {
      try {
        return read()
      } catch {
        return UNINITIALIZED
      }
    },
  }

  const log = (...args) => {
    logs.push({ frame: frames.length - 1, text: args.map((a) => (typeof a === 'string' ? a : formatValue(freeze(a)))).join(' ') })
  }
  const fakeConsole = { log, info: log, warn: log, error: log, debug: log }

  let returned
  let truncated = false
  let error = null
  try {
    const fn = new Function(INPUT_NAME, 'console', ...RUNTIME_NAMES, program.code)
    returned = freeze(fn(structuredClone(arr), fakeConsole, ...RUNTIME_NAMES.map((name) => runtime[name])))
  } catch (err) {
    if (err === STEP_LIMIT) truncated = true
    else error = { kind: 'runtime', message: `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}`, line: frames.at(-1)?.line ?? null }
  }

  return { frames, logs, loops, pointerVars, conditions, branches, truncated, returned, error }
}
