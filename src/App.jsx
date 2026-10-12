import { useEffect, useMemo, useState } from 'react'
import ArrayInput from './components/ArrayInput.jsx'
import ArrayView from './components/ArrayView.jsx'
import CodePreview from './components/CodePreview.jsx'
import Controls from './components/Controls.jsx'
import LoopConfig from './components/LoopConfig.jsx'
import VarsPanel from './components/VarsPanel.jsx'
import { defaultLoop, generateFrames, LOOP_VARS, MAX_FRAMES } from './lib/generateFrames.js'
import { parseArray } from './lib/parseArray.js'

const STORAGE_KEY = 'loop-visualizer:config'

function loadConfig() {
  const fallback = { arrText: '[2, 7, 11, 15]', loops: [defaultLoop(0), defaultLoop(1)] }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (typeof saved?.arrText === 'string' && Array.isArray(saved.loops) && saved.loops.length > 0) {
      return saved
    }
  } catch {
    // storage unavailable or corrupt: use defaults
  }
  return fallback
}

export default function App() {
  const [initial] = useState(loadConfig)
  const [arrText, setArrText] = useState(initial.arrText)
  const [arr, setArr] = useState(() => {
    try {
      return parseArray(initial.arrText)
    } catch {
      return []
    }
  })
  const [arrError, setArrError] = useState(null)
  const [loops, setLoops] = useState(initial.loops)
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(500)

  const { frames, truncated, error } = useMemo(() => generateFrames(arr, loops), [arr, loops])
  const total = frames.length
  const current = Math.min(cursor, Math.max(total - 1, 0))
  const frame = frames[current]
  // Playback stops on its own at the last frame without needing an effect to flip state.
  const isPlaying = playing && current < total - 1

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ arrText, loops }))
    } catch {
      // ignore
    }
  }, [arrText, loops])

  const handleArrayText = (text) => {
    setArrText(text)
    try {
      setArr(parseArray(text))
      setArrError(null)
      setCursor(0)
      setPlaying(false)
    } catch (err) {
      setArrError(err.message)
    }
  }

  const handleLoops = (next) => {
    setLoops(next)
    setCursor(0)
    setPlaying(false)
  }

  const seek = (index) => setCursor(Math.max(0, Math.min(index, total - 1)))

  const togglePlay = () => {
    if (isPlaying) {
      setPlaying(false)
    } else {
      if (current >= total - 1) setCursor(0)
      setPlaying(true)
    }
  }

  useEffect(() => {
    if (!isPlaying) return
    const id = setInterval(() => setCursor((c) => Math.min(c + 1, total - 1)), speed)
    return () => clearInterval(id)
  }, [isPlaying, speed, total])

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') seek(current + 1)
      else if (e.key === 'ArrowLeft') seek(current - 1)
      else if (e.key === 'Home') seek(0)
      else if (e.key === 'End') seek(total - 1)
      else if (e.key === ' ' && tag !== 'BUTTON') togglePlay()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const status = frame
    ? frame.event === 'skip'
      ? `Loop ${LOOP_VARS[frame.level]} skipped: condition false on entry`
      : `Loop ${LOOP_VARS[frame.level]} → ${frame.vars[LOOP_VARS[frame.level]]}`
    : null

  return (
    <main className="app">
      <header>
        <h1>Loop Visualizer</h1>
        <p className="hint">Step through nested loops over an array. ← → to step, Space to play.</p>
      </header>

      <div className="layout">
        <div className="col">
          <ArrayInput text={arrText} error={arrError} onChange={handleArrayText} />
          <LoopConfig loops={loops} onChange={handleLoops} />
          <CodePreview loops={loops} frame={frame} />
        </div>
        <div className="col">
          <ArrayView arr={arr} frame={frame} />
          {error && <p className="error panel">{error}</p>}
          {truncated && (
            <p className="warning panel">
              Stopped after {MAX_FRAMES.toLocaleString()} steps. Check the loop condition for an infinite loop.
            </p>
          )}
          {!error && total === 0 && <p className="warning panel">The outer loop runs 0 times.</p>}
          {status && <p className={`status ${frame.event === 'skip' ? 'skip' : ''}`}>{status}</p>}
          <Controls
            cursor={current}
            total={total}
            playing={isPlaying}
            speed={speed}
            onSeek={(i) => {
              setPlaying(false)
              seek(i)
            }}
            onTogglePlay={togglePlay}
            onSpeed={setSpeed}
          />
          <VarsPanel arr={arr} loops={loops} frame={frame} />
        </div>
      </div>
    </main>
  )
}
