import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import { Decoration, drawSelection, EditorView, keymap, lineNumbers } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { useEffect, useRef, useState } from 'react'
import { clamp, loadNumber, saveNumber, startPointerDrag } from '../lib/drag.js'

const setLineMarks = StateEffect.define()

const lineMarks = StateField.define({
  create: () => Decoration.none,
  update(marks, tr) {
    let next = marks.map(tr.changes)
    for (const effect of tr.effects) if (effect.is(setLineMarks)) next = effect.value
    return next
  },
  provide: (field) => EditorView.decorations.from(field),
})

const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.operatorKeyword], color: 'var(--syn-keyword)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--syn-number)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--syn-string)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--muted)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--syn-function)' },
  { tag: tags.definition(tags.variableName), color: 'var(--syn-def)' },
])

const theme = EditorView.theme({
  '&': { backgroundColor: 'var(--code-bg)', color: 'var(--text)', fontSize: 'var(--editor-font-size, 13px)' },
  '&.cm-focused': { outline: '1px solid var(--green)', borderColor: 'var(--green)' },
  '.cm-scroller': { fontFamily: 'var(--font)', lineHeight: '1.6' },
  '.cm-content': { caretColor: 'var(--text)', padding: '8px 0' },
  '.cm-cursor': { borderLeft: '0.6em solid var(--green)', opacity: 0.5 },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--grey0)', borderRight: '1px dashed var(--border)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'var(--selection) !important' },
  '.cm-matchingBracket': { backgroundColor: 'var(--selection)', outline: 'none' },
  '.cm-step-current': { backgroundColor: 'var(--current)', boxShadow: 'inset 3px 0 var(--p0)' },
  '.cm-step-skip': { backgroundColor: 'var(--skip)', boxShadow: 'inset 3px 0 var(--warn)' },
  '.cm-step-error': { backgroundColor: 'var(--error-bg)', boxShadow: 'inset 3px 0 var(--error)' },
})

const HEIGHT_KEY = 'loop-visualizer:editor-height'
const DEFAULT_HEIGHT = 340
const MIN_HEIGHT = 160
const MAX_HEIGHT = 1600
const clampHeight = (h) => Math.round(clamp(h, MIN_HEIGHT, MAX_HEIGHT))

const FONT_KEY = 'loop-visualizer:editor-font-size'
const DEFAULT_FONT = 13
const MIN_FONT = 9
const MAX_FONT = 28
const clampFont = (size) => clamp(Math.round(size), MIN_FONT, MAX_FONT)
// Wheel distance (in deltaY units) per zoom step, so trackpad pinches don't zoom too fast.
const WHEEL_STEP = 60

export default function CodeEditor({ value, onChange, activeLine, activeKind, errorLine }) {
  const [height, setHeight] = useState(() => loadNumber(HEIGHT_KEY, DEFAULT_HEIGHT, clampHeight))
  const [fontSize, setFontSize] = useState(() => loadNumber(FONT_KEY, DEFAULT_FONT, clampFont))
  const hostRef = useRef(null)
  const viewRef = useRef(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const zoomBy = (delta) => setFontSize((size) => clampFont(size + delta))
  const zoomKeymap = [
    { key: 'Mod-=', run: () => (zoomBy(1), true) },
    { key: 'Mod-+', run: () => (zoomBy(1), true) },
    { key: 'Mod--', run: () => (zoomBy(-1), true) },
    { key: 'Mod-0', run: () => (setFontSize(DEFAULT_FONT), true) },
  ]

  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          EditorState.tabSize.of(2),
          keymap.of([
            ...zoomKeymap,
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          javascript(),
          syntaxHighlighting(highlight),
          theme,
          lineMarks,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => view.destroy()
    // The editor is created once; later `value` changes are synced by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply changes made outside the editor (the loop form) without clobbering identical text.
  useEffect(() => {
    const view = viewRef.current
    const current = view.state.doc.toString()
    if (current !== value) view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    const { doc } = view.state
    const marks = []
    if (errorLine && errorLine <= doc.lines) {
      marks.push(Decoration.line({ class: 'cm-step-error' }).range(doc.line(errorLine).from))
    }
    if (activeLine && activeLine <= doc.lines && activeLine !== errorLine) {
      const cls = activeKind === 'skip' ? 'cm-step-skip' : 'cm-step-current'
      marks.push(Decoration.line({ class: cls }).range(doc.line(activeLine).from))
    }
    marks.sort((a, b) => a.from - b.from)
    const effects = [setLineMarks.of(Decoration.set(marks))]
    if (activeLine && activeLine <= doc.lines && !view.hasFocus) {
      effects.push(EditorView.scrollIntoView(doc.line(activeLine).from, { y: 'nearest' }))
    }
    view.dispatch({ effects })
  }, [activeLine, activeKind, errorLine, value])

  useEffect(() => saveNumber(HEIGHT_KEY, height), [height])

  useEffect(() => {
    saveNumber(FONT_KEY, fontSize)
    viewRef.current.requestMeasure()
  }, [fontSize])

  // Ctrl/Cmd + scroll over the editor zooms it instead of the page.
  useEffect(() => {
    const host = hostRef.current
    let pending = 0
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      pending += e.deltaY
      while (Math.abs(pending) >= WHEEL_STEP) {
        const direction = Math.sign(pending)
        setFontSize((size) => clampFont(size - direction))
        pending -= direction * WHEEL_STEP
      }
    }
    host.addEventListener('wheel', onWheel, { passive: false })
    return () => host.removeEventListener('wheel', onWheel)
  }, [])

  // Drag the handle under the editor to resize it vertically.
  const startResize = (e) => {
    const startY = e.clientY
    const startHeight = height
    startPointerDrag(e, (ev) => setHeight(clampHeight(startHeight + ev.clientY - startY)), 'row')
  }

  const resizeWithKeys = (e) => {
    const step = e.shiftKey ? 80 : 20
    if (e.key === 'ArrowUp') setHeight((h) => clampHeight(h - step))
    else if (e.key === 'ArrowDown') setHeight((h) => clampHeight(h + step))
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div className="editor">
      <div className="editor-zoom" role="group" aria-label="Editor zoom">
        <button onClick={() => zoomBy(-1)} disabled={fontSize <= MIN_FONT} aria-label="Zoom out" title="Zoom out (Ctrl -)">
          −
        </button>
        <button className="zoom-level" onClick={() => setFontSize(DEFAULT_FONT)} title="Reset zoom (Ctrl 0)">
          {Math.round((fontSize / DEFAULT_FONT) * 100)}%
        </button>
        <button onClick={() => zoomBy(1)} disabled={fontSize >= MAX_FONT} aria-label="Zoom in" title="Zoom in (Ctrl +)">
          +
        </button>
      </div>
      <div className="editor-host" ref={hostRef} style={{ height, '--editor-font-size': `${fontSize}px` }} />
      <div
        className="editor-resize"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize code editor"
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={MAX_HEIGHT}
        aria-valuenow={height}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={startResize}
        onKeyDown={resizeWithKeys}
        onDoubleClick={() => setHeight(DEFAULT_HEIGHT)}
      />
    </div>
  )
}
