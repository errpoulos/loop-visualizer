export default function ArrayInput({ text, error, onChange }) {
  return (
    <section className="panel">
      <label className="panel-title" htmlFor="array-input">Array</label>
      <input
        id="array-input"
        className={`mono ${error ? 'invalid' : ''}`}
        value={text}
        spellCheck={false}
        placeholder="[2, 7, 11, 15]"
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
    </section>
  )
}
