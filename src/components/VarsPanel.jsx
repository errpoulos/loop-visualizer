const formatValue = (value) => (typeof value === 'string' ? JSON.stringify(value) : String(value))

export default function VarsPanel({ arr, loops, frame }) {
  return (
    <section className="panel">
      <h2 className="panel-title">Variables</h2>
      <table className="vars mono">
        <thead>
          <tr>
            <th>var</th>
            <th>value</th>
            <th>arr[var]</th>
            <th>range</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>n</td>
            <td>{arr.length}</td>
            <td />
            <td />
          </tr>
          {loops.map((loop, level) => {
            const value = frame?.vars[loop.var]
            const bounds = frame?.bounds[level]
            const inRange = value !== undefined && value >= 0 && value < arr.length
            return (
              <tr key={loop.var}>
                <td><span className={`var-badge var-${loop.var}`}>{loop.var}</span></td>
                <td>{value ?? '—'}</td>
                <td className={value !== undefined && !inRange ? 'oob' : ''}>
                  {value === undefined ? '—' : inRange ? formatValue(arr[value]) : 'out of bounds'}
                </td>
                <td>{bounds ? `${bounds.start} ${loop.cmp} … ${bounds.end}` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
