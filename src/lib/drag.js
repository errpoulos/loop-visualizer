// Shared helpers for the editor and column resize handles.

// Follows a pointer drag that started on `e.currentTarget`, calling onMove(event) until release.
// `cursor` ('row' | 'col') keeps the resize cursor and blocks text selection page-wide meanwhile.
export function startPointerDrag(e, onMove, cursor) {
  if (e.button !== 0) return
  e.preventDefault()
  const handle = e.currentTarget
  handle.setPointerCapture(e.pointerId)
  document.body.dataset.dragging = cursor
  const onEnd = () => {
    delete document.body.dataset.dragging
    handle.removeEventListener('pointermove', onMove)
    handle.removeEventListener('pointerup', onEnd)
    handle.removeEventListener('pointercancel', onEnd)
  }
  handle.addEventListener('pointermove', onMove)
  handle.addEventListener('pointerup', onEnd)
  handle.addEventListener('pointercancel', onEnd)
}

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

// Reads a number saved in localStorage, falling back when it's missing or storage is unavailable.
export function loadNumber(key, fallback, normalize = (v) => v) {
  try {
    const saved = Number(localStorage.getItem(key))
    return saved ? normalize(saved) : fallback
  } catch {
    return fallback
  }
}

export function saveNumber(key, value) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // storage unavailable: the setting just won't persist
  }
}
