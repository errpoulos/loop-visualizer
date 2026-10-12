import { formatValue } from '../lib/runCode.js'

export default function OutputPanel({ logs, finished, returned }) {
  if (logs.length === 0 && !finished) return null
  return (
    <section className="panel">
      <h2 className="panel-title">Output</h2>
      <pre className="output mono">
        {logs.map((log, i) => (
          <div key={i}>{log.text}</div>
        ))}
        {finished && (
          <div className="muted">{returned === undefined ? '✓ finished' : `↩ returned ${formatValue(returned)}`}</div>
        )}
      </pre>
    </section>
  )
}
