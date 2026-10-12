import { formatValue } from '../lib/runCode.js'

export default function ArrayView({ arr, prevArr, pointers, emphasized, colorFor }) {
  const n = arr.length

  // Show one ghost cell past either end when a pointer lands there (classic off-by-one).
  const showBefore = pointers.some(([, v]) => v < 0)
  const showAfter = pointers.some(([, v]) => v >= n)
  const indices = []
  if (showBefore) indices.push(-1)
  for (let i = 0; i < n; i++) indices.push(i)
  if (showAfter) indices.push(n)

  const pointersAt = (index) =>
    pointers.filter(([, value]) => {
      if (index === -1) return value < 0
      if (index === n) return value >= n
      return value === index
    })

  return (
    <section className="panel array-panel">
      <h2 className="panel-title">arr</h2>
      <div className="array-scroll">
        <div className="array-row">
          {indices.map((index) => {
            const here = pointersAt(index)
            const ghost = index < 0 || index >= n
            const top = here.find(([name]) => emphasized.has(name)) ?? here.at(-1)
            const changed = !ghost && prevArr && index < prevArr.length && formatValue(prevArr[index]) !== formatValue(arr[index])
            return (
              <div className="cell-col" key={index}>
                <div className="pointers">
                  {here.map(([name, value]) => (
                    <span
                      key={name}
                      className={`pointer ${emphasized.has(name) ? 'active' : ''}`}
                      style={{ '--c': colorFor(name) }}
                    >
                      {ghost && value !== index ? `${name}=${value}` : name}
                      <span className="arrow">▼</span>
                    </span>
                  ))}
                </div>
                <div
                  className={`cell mono ${ghost ? 'ghost' : ''} ${top ? 'pointed' : ''} ${changed ? 'changed' : ''}`}
                  style={top ? { '--c': colorFor(top[0]) } : undefined}
                  title={ghost ? 'out of bounds' : formatValue(arr[index])}
                >
                  {ghost ? '' : formatValue(arr[index])}
                </div>
                <div className="cell-index mono">{index}</div>
              </div>
            )
          })}
          {n === 0 && <p className="hint">Empty array (n = 0)</p>}
        </div>
      </div>
    </section>
  )
}
