import { LOOP_VARS } from '../lib/generateFrames.js'

export default function ArrayView({ arr, frame }) {
  const vars = frame ? frame.vars : {}
  const activeVar = frame ? LOOP_VARS[frame.level] : null
  const isSkip = frame?.event === 'skip'
  const n = arr.length

  // Show one ghost cell past either end when a pointer lands there (classic off-by-one).
  const pointerValues = Object.values(vars)
  const showBefore = pointerValues.some((v) => v < 0)
  const showAfter = pointerValues.some((v) => v >= n)
  const indices = []
  if (showBefore) indices.push(-1)
  for (let i = 0; i < n; i++) indices.push(i)
  if (showAfter) indices.push(n)

  const pointersAt = (index) =>
    Object.entries(vars).filter(([, value]) => {
      if (index === -1) return value < 0
      if (index === n) return value >= n
      return value === index
    })

  return (
    <section className="panel array-panel">
      <div className="array-scroll">
        <div className="array-row">
          {indices.map((index) => {
            const pointers = pointersAt(index)
            const ghost = index < 0 || index >= n
            const deepest = pointers.at(-1)?.[0]
            return (
              <div className="cell-col" key={index}>
                <div className="pointers">
                  {pointers.map(([name, value]) => (
                    <span
                      key={name}
                      className={`pointer var-${name} ${name === activeVar && !isSkip ? 'active' : ''}`}
                    >
                      {ghost && value !== index ? `${name}=${value}` : name}
                      <span className="arrow">▼</span>
                    </span>
                  ))}
                </div>
                <div className={`cell mono ${ghost ? 'ghost' : ''} ${deepest ? `hl-${deepest}` : ''}`}>
                  {ghost ? '' : String(arr[index])}
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
