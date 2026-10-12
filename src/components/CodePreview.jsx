export default function CodePreview({ loops, frame }) {
  const pad = (level) => '  '.repeat(level)
  const activeLevel = frame?.level
  const isSkip = frame?.event === 'skip'

  return (
    <section className="panel">
      <h2 className="panel-title">Code</h2>
      <pre className="code mono">
        <div className="code-line">const n = arr.length;</div>
        {loops.map((loop, level) => {
          const step = loop.dir === 'reverse' ? `${loop.var}--` : `${loop.var}++`
          const active = level === activeLevel
          return (
            <div
              key={loop.var}
              className={`code-line ${active ? (isSkip ? 'skip' : 'current') : ''}`}
            >
              {`${pad(level)}for (let ${loop.var} = ${loop.start}; ${loop.var} ${loop.cmp} ${loop.end}; ${step}) {`}
              {active && isSkip && <span className="code-note">  ← condition false, 0 iterations</span>}
            </div>
          )
        })}
        <div className="code-line muted">{`${pad(loops.length)}// body`}</div>
        {loops.map((loop, level) => (
          <div className="code-line" key={loop.var}>
            {`${pad(loops.length - 1 - level)}}`}
          </div>
        ))}
      </pre>
    </section>
  )
}
