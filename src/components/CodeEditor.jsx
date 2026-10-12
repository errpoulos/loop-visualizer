import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import { Decoration, drawSelection, EditorView, keymap, lineNumbers } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { useEffect, useRef } from 'react'

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
  '&': { backgroundColor: 'var(--code-bg)', color: 'var(--text)', fontSize: '13px' },
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

export default function CodeEditor({ value, onChange, activeLine, activeKind, errorLine }) {
  const hostRef = useRef(null)
  const viewRef = useRef(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

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
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
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

  return <div className="editor" ref={hostRef} />
}
