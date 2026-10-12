export default function Controls({ cursor, total, playing, speed, mode, onSeek, onTogglePlay, onSpeed, onMode }) {
  const last = total - 1
  const disabled = total === 0
  return (
    <section className="panel controls">
      <div className="buttons">
        <button disabled={disabled || cursor === 0} onClick={() => onSeek(0)} title="First (Home)">⏮</button>
        <button disabled={disabled || cursor === 0} onClick={() => onSeek(cursor - 1)} title="Previous (←)">◀</button>
        <button className="play" disabled={disabled} onClick={onTogglePlay} title="Play / pause (Space)">
          {playing ? '⏸' : '▶'}
        </button>
        <button disabled={disabled || cursor >= last} onClick={() => onSeek(cursor + 1)} title="Next (→)">▶|</button>
        <button disabled={disabled || cursor >= last} onClick={() => onSeek(last)} title="Last (End)">⏭</button>
        <span className="step-count mono">
          {disabled ? 'No steps' : `Step ${cursor + 1} / ${total}`}
        </span>
      </div>
      <input
        type="range"
        className="scrubber"
        min={0}
        max={Math.max(last, 0)}
        value={cursor}
        disabled={disabled}
        aria-label="Step"
        onChange={(e) => onSeek(Number(e.target.value))}
      />
      <div className="control-row">
        <div className="segmented" role="group" aria-label="Step by">
          <span>Step by</span>
          <button className={mode === 'loops' ? 'on' : ''} onClick={() => onMode('loops')}>loop iteration</button>
          <button className={mode === 'lines' ? 'on' : ''} onClick={() => onMode('lines')}>every line</button>
        </div>
        <label className="speed">
          <span>Speed</span>
          <input
            type="range"
            min={50}
            max={1500}
            step={50}
            value={1550 - speed}
            aria-label="Playback speed"
            onChange={(e) => onSpeed(1550 - Number(e.target.value))}
          />
          <span className="mono">{speed}ms</span>
        </label>
      </div>
    </section>
  )
}
