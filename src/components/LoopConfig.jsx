import { defaultLoop, LOOP_VARS } from '../lib/generateFrames.js'

const CMP_OPTIONS = {
  forward: ['<', '<='],
  reverse: ['>', '>='],
}

export default function LoopConfig({ loops, onChange }) {
  const update = (level, patch) => {
    onChange(loops.map((loop, i) => (i === level ? { ...loop, ...patch } : loop)))
  }

  const changeDirection = (level, dir) => {
    onChange(loops.map((loop, i) => (i === level ? defaultLoop(level, dir) : loop)))
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Loops</h2>
      {loops.map((loop, level) => {
        const scopeVars = ['n', ...LOOP_VARS.slice(0, level)].join(', ')
        return (
          <div className="loop-row" key={loop.var} style={{ marginLeft: level * 20 }}>
            <span className={`var-badge var-${loop.var}`}>{loop.var}</span>
            <select
              value={loop.dir}
              aria-label={`${loop.var} direction`}
              onChange={(e) => changeDirection(level, e.target.value)}
            >
              <option value="forward">forward ++</option>
              <option value="reverse">reverse --</option>
            </select>
            <label className="field">
              <span>start</span>
              <input
                className="mono"
                value={loop.start}
                title={`Can use: ${scopeVars}`}
                spellCheck={false}
                onChange={(e) => update(level, { start: e.target.value })}
              />
            </label>
            <select
              className="mono"
              value={loop.cmp}
              aria-label={`${loop.var} comparator`}
              onChange={(e) => update(level, { cmp: e.target.value })}
            >
              {CMP_OPTIONS[loop.dir].map((cmp) => (
                <option key={cmp} value={cmp}>{`${loop.var} ${cmp}`}</option>
              ))}
            </select>
            <label className="field">
              <span>end</span>
              <input
                className="mono"
                value={loop.end}
                title={`Can use: ${scopeVars}`}
                spellCheck={false}
                onChange={(e) => update(level, { end: e.target.value })}
              />
            </label>
            {level > 0 && level === loops.length - 1 && (
              <button
                className="icon-btn"
                aria-label={`Remove loop ${loop.var}`}
                onClick={() => onChange(loops.slice(0, -1))}
              >
                ✕
              </button>
            )}
          </div>
        )
      })}
      {loops.length < LOOP_VARS.length && (
        <button className="add-btn" onClick={() => onChange([...loops, defaultLoop(loops.length)])}>
          + Add nested loop ({LOOP_VARS[loops.length]})
        </button>
      )}
      <p className="hint">
        Expressions can use <code>n</code> (array length) and outer loop variables, e.g.{' '}
        <code>i + 1</code>, <code>n - 1</code>, <code>n / 2</code>.
      </p>
    </section>
  )
}
