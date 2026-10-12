import { formatValue } from '../lib/runCode.js'

function branchLabel(cond, taken) {
  if (taken) return `then → line ${cond.thenLine}`
  if (cond.elseLine == null) return 'no branch (skipped)'
  return `${cond.elseIsIf ? 'else if' : 'else'} → line ${cond.elseLine}`
}

function evaluated({ cond, last }) {
  if (last.operands) return `${formatValue(last.operands[0])} ${cond.operator} ${formatValue(last.operands[1])}`
  return formatValue(last.value)
}

function BranchTable({ branches }) {
  return (
    <table className="vars branches mono">
      <thead>
        <tr>
          <th>line</th>
          <th>condition</th>
          <th>evaluated</th>
          <th>branch</th>
        </tr>
      </thead>
      <tbody>
        {branches.map((group) => {
          const { cond, last, count, trueCount } = group
          return (
            <tr key={`${cond.line}:${cond.text}`}>
              <td className="muted">{cond.line}</td>
              <td className="value">{cond.kind === 'ternary' ? `${cond.text} ? :` : `if (${cond.text})`}</td>
              <td className="value">
                {evaluated(group)} <span className={`bool ${last.taken ? 'yes' : 'no'}`}>{String(last.taken)}</span>
              </td>
              <td>
                {branchLabel(cond, last.taken)}
                {count > 1 && (
                  <span className="muted" title="Evaluated more than once since the last step; showing the latest">
                    {' '}(×{count}: {trueCount} true, {count - trueCount} false)
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default function VarsPanel({ vars, arr, pointerVars, changed, colorFor, branches, hasConditions }) {
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
      {hasConditions && (
        <>
          <h3 className="panel-subtitle">Branches since last step</h3>
          {branches.length === 0 ? (
            <p className="hint">No conditions evaluated since the last step.</p>
          ) : (
            <BranchTable branches={branches} />
          )}
        </>
      )}
    </section>
  )
}
