import { useCallback, useEffect, useMemo, useState } from 'react'
import ArrayInput from './components/ArrayInput.jsx'
import ArrayView from './components/ArrayView.jsx'
import CodeEditor from './components/CodeEditor.jsx'
import Controls from './components/Controls.jsx'
import LoopConfig from './components/LoopConfig.jsx'
import OutputPanel from './components/OutputPanel.jsx'
import VarsPanel from './components/VarsPanel.jsx'
import {
  addInnerLoop, DEFAULT_CODE, parseLoopChain, removeInnerLoop, setDirection, updateLoop,
} from './lib/loopSync.js'
import { parseArray } from './lib/parseArray.js'
import { formatValue, MAX_STEPS, runCode } from './lib/runCode.js'

const STORAGE_KEY = 'loop-visualizer:v2'
const PALETTE_SIZE = 6

function loadConfig() {
  const fallback = { arrText: '[2, 7, 11, 15]', code: DEFAULT_CODE, mode: 'loops' }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (typeof saved?.arrText === 'string' && typeof saved.code === 'string') return { ...fallback, ...saved }
  } catch {
    // storage unavailable or corrupt: use defaults
  }
  return fallback
}

const isVisible = (frame, mode) => mode === 'lines' || frame.kind !== 'stmt'

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
  const [code, setCode] = useState(initial.code)
  const [runSource, setRunSource] = useState(initial.code)
  const [mode, setMode] = useState(initial.mode)
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(500)

  // Re-run shortly after typing stops rather than on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setRunSource(code), 250)
    return () => clearTimeout(id)
  }, [code])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ arrText, code, mode }))
    } catch {
      // ignore
    }
  }, [arrText, code, mode])

  const result = useMemo(() => runCode(runSource, arr), [runSource, arr])
  const chain = useMemo(() => parseLoopChain(code), [code])
  const visible = useMemo(
    () => result.frames.flatMap((frame, index) => (isVisible(frame, mode) ? [index] : [])),
    [result, mode],
  )

  const total = visible.length
  const current = Math.min(cursor, Math.max(total - 1, 0))
  const frameIndex = visible[current]
  const frame = result.frames[frameIndex]
  const prevFrame = frameIndex > 0 ? result.frames[frameIndex - 1] : null
  // Playback stops on its own at the last frame without needing an effect to flip state.
  const isPlaying = playing && current < total - 1

  const colorFor = useCallback(
    (name) => {
      const loopVars = (chain ?? []).map((l) => l.var)
      const order = [...loopVars, ...result.pointerVars.filter((v) => !loopVars.includes(v))]
      const index = order.indexOf(name)
      return `var(--p${(index < 0 ? 0 : index) % PALETTE_SIZE})`
    },
    [chain, result.pointerVars],
  )

  const vars = frame?.vars ?? { arr }
  const displayArr = Array.isArray(vars.arr) ? vars.arr : arr
  const prevArr = Array.isArray(prevFrame?.vars.arr) ? prevFrame.vars.arr : null
  const changed = new Set(
    prevFrame ? Object.keys(vars).filter((k) => formatValue(vars[k]) !== formatValue(prevFrame.vars[k])) : [],
  )
  const loopVar = frame && frame.kind !== 'stmt' ? result.loops[frame.loopId]?.var : null
  const emphasized = new Set(loopVar ? [loopVar] : changed)
  const pointers = result.pointerVars
    .filter((name) => Number.isInteger(vars[name]))
    .map((name) => [name, vars[name]])

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

  const applyCode = (next) => {
    if (next === code) return
    setCode(next)
    setPlaying(false)
  }

  const commitLoopEdit = (index, patch) => {
    const next = updateLoop(code, index, patch)
    if (!parseLoopChain(next)) return false
    applyCode(next)
    return true
  }

  const changeMode = (nextMode) => {
    if (nextMode === mode) return
    const nextVisible = result.frames.flatMap((f, i) => (isVisible(f, nextMode) ? [i] : []))
    const at = frameIndex ?? 0
    let pos = 0
    nextVisible.forEach((frameIdx, i) => {
      if (frameIdx <= at) pos = i
    })
    setMode(nextMode)
    setCursor(pos)
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
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.target.closest?.('.cm-editor')) return
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

  let status = null
  if (frame?.kind === 'skip') status = `Line ${frame.line}: loop ${loopVar ?? ''} skipped, condition false on entry`
  else if (frame?.kind === 'iter') {
    status = loopVar
      ? `Line ${frame.line}: loop ${loopVar} → ${formatValue(vars[loopVar])}`
      : `Line ${frame.line}: loop iteration`
  } else if (frame) status = `Line ${frame.line}: about to run`

  const { error } = result
  const atEnd = total > 0 && current === total - 1
  const logs = atEnd ? result.logs : frame ? result.logs.filter((log) => log.frame <= frameIndex) : []

  return (
    <main className="app">
      <header>
        <h1>Loop Visualizer</h1>
        <p className="hint">
          Write JS against <code>arr</code> and step through it. ← → to step, Space to play.
        </p>
      </header>

      <div className="layout">
        <div className="col">
          <ArrayInput text={arrText} error={arrError} onChange={handleArrayText} />
          <LoopConfig
            chain={chain}
            colorFor={colorFor}
            onUpdate={commitLoopEdit}
            onDirection={(index, dir) => applyCode(setDirection(code, index, dir))}
            onAdd={() => applyCode(addInnerLoop(code))}
            onRemove={() => applyCode(removeInnerLoop(code))}
          />
          <section className="panel">
            <h2 className="panel-title">Code</h2>
            <CodeEditor
              value={code}
              onChange={applyCode}
              activeLine={frame?.line}
              activeKind={frame?.kind}
              errorLine={error?.line}
            />
            <p className="hint">
              <code>arr</code> is a copy of your array. Use <code>return</code> and <code>console.log</code> to see results.
            </p>
          </section>
        </div>
        <div className="col">
          <ArrayView arr={displayArr} prevArr={prevArr} pointers={pointers} emphasized={emphasized} colorFor={colorFor} />
          {error && (
            <p className="error panel">
              {error.kind === 'syntax' ? 'Syntax error' : 'Runtime error'}
              {error.line ? ` on line ${error.line}` : ''}: {error.message}
            </p>
          )}
          {result.truncated && (
            <p className="warning panel">
              Stopped after {MAX_STEPS.toLocaleString()} steps. Check for an infinite loop.
            </p>
          )}
          {!error && total === 0 && (
            <p className="warning panel">
              {result.frames.length === 0 ? 'Nothing ran yet.' : 'No loop iterations. Switch to "every line" to step through statements.'}
            </p>
          )}
          {status && <p className={`status ${frame.kind === 'skip' ? 'skip' : ''}`}>{status}</p>}
          <Controls
            cursor={current}
            total={total}
            playing={isPlaying}
            speed={speed}
            mode={mode}
            onSeek={(i) => {
              setPlaying(false)
              seek(i)
            }}
            onTogglePlay={togglePlay}
            onSpeed={setSpeed}
            onMode={changeMode}
          />
          <VarsPanel vars={vars} arr={displayArr} pointerVars={result.pointerVars} changed={changed} colorFor={colorFor} />
          <OutputPanel logs={logs} finished={atEnd && !error && !result.truncated} returned={result.returned} />
        </div>
      </div>
    </main>
  )
}
