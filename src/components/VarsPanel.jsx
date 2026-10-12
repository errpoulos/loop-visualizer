import { formatValue } from '../lib/runCode.js'

export default function VarsPanel({ vars, arr, pointerVars, changed, colorFor }) {
  const entries = Object.entries(vars).filter(([name]) => name !== 'arr')
  return (
    <section className="panel">
      <h2 className="panel-title">Variables</h2>
      {entries.length === 0 ? (
        <p className="hint">No variables in scope yet.</p>
      ) : (
        <table className="vars mono">
          <thead>
            <tr>
              <th>name</th>
              <th>value</th>
              <th>arr[name]</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([name, value]) => {
              const isPointer = pointerVars.includes(name) && Number.isInteger(value)
              const inRange = isPointer && value >= 0 && value < arr.length
              return (
                <tr key={name} className={changed.has(name) ? 'changed' : ''}>
                  <td>
                    {isPointer ? (
                      <span className="var-badge small" style={{ '--c': colorFor(name) }}>{name}</span>
                    ) : (
                      name
                    )}
                  </td>
                  <td className="value">{formatValue(value)}</td>
                  <td className={isPointer && !inRange ? 'oob' : ''}>
                    {!isPointer ? '' : inRange ? formatValue(arr[value]) : 'out of bounds'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
