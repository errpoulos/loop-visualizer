import { useState } from 'react'
import { MAX_FORM_LOOPS } from '../lib/loopSync.js'

const CMP_OPTIONS = {
  forward: ['<', '<='],
  reverse: ['>', '>='],
}

// Shows the code's value unless focused; while typing, keeps a draft and commits only text that
// still parses, so a half-typed expression doesn't break the code.
function ExprField({ label, value, title, onCommit }) {
  const [draft, setDraft] = useState(null)
  const [invalid, setInvalid] = useState(false)
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className={`mono ${invalid ? 'invalid' : ''}`}
        value={draft ?? value}
        title={title}
        spellCheck={false}
        onFocus={() => setDraft(value)}
        onBlur={() => {
          setDraft(null)
          setInvalid(false)
        }}
        onChange={(e) => {
          setDraft(e.target.value)
          setInvalid(e.target.value.trim() === '' || !onCommit(e.target.value))
        }}
      />
    </label>
  )
}

export default function LoopConfig({ chain, colorFor, onUpdate, onDirection, onAdd, onRemove }) {
  if (!chain) {
    return (
      <section className="panel">
        <h2 className="panel-title">Loops</h2>
        <p className="hint">Fix the syntax error in the code to edit loops here.</p>
      </section>
    )
  }

  const canAdd = chain.length < MAX_FORM_LOOPS && (chain.length === 0 || chain.at(-1).node.body.type === 'BlockStatement')

  return (
    <section className="panel">
      <h2 className="panel-title">Loops</h2>
      {chain.length === 0 && <p className="hint">No for-loops in the code yet.</p>}
      {chain.map((loop, level) => {
        const scope = ['n', ...chain.slice(0, level).map((l) => l.var)].join(', ')
        const badge = (
          <span className="var-badge" style={{ '--c': colorFor(loop.var) }}>
            {loop.var ?? '?'}
          </span>
        )
        if (!loop.simple) {
          return (
            <div className="loop-row" key={level} style={{ marginLeft: level * 20 }}>
              {badge}
              <code className="custom-loop">{loop.header}</code>
              <span className="hint inline">edit in code</span>
            </div>
          )
        }
        return (
          <div className="loop-row" key={level} style={{ marginLeft: level * 20 }}>
            {badge}
            <select
              value={loop.dir}
              aria-label={`${loop.var} direction`}
              onChange={(e) => onDirection(level, e.target.value)}
            >
              <option value="forward">forward ++</option>
              <option value="reverse">reverse --</option>
            </select>
            <ExprField
              label="start"
              value={loop.start}
              title={`Any JS expression; can use ${scope}`}
              onCommit={(start) => onUpdate(level, { start })}
            />
            <select
              className="mono"
              value={loop.cmp}
              aria-label={`${loop.var} comparator`}
              onChange={(e) => onUpdate(level, { cmp: e.target.value })}
            >
              {CMP_OPTIONS[loop.dir].map((cmp) => (
                <option key={cmp} value={cmp}>{`${loop.var} ${cmp}`}</option>
              ))}
            </select>
            <ExprField
              label="end"
              value={loop.end}
              title={`Any JS expression; can use ${scope}`}
              onCommit={(end) => onUpdate(level, { end })}
            />
            {level > 0 && level === chain.length - 1 && (
              <button className="icon-btn" aria-label={`Remove loop ${loop.var}`} title="Remove loop (keeps its body)" onClick={onRemove}>
                ✕
              </button>
            )}
          </div>
        )
      })}
      {canAdd && (
        <button className="add-btn" onClick={onAdd}>
          + {chain.length === 0 ? 'Add a loop' : 'Add nested loop'}
        </button>
      )}
      <p className="hint">The form and the code stay in sync. Edit either one.</p>
    </section>
  )
}
