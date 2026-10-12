// Accepts "[1, 2, 3]", "1, 2, 3", or '["a", "b"]'. Bare non-numeric tokens become strings.
export function parseArray(text) {
  const trimmed = text.trim()
  const inner = trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed
  if (inner.trim() === '') return []
  try {
    const parsed = JSON.parse(`[${inner}]`)
    if (parsed.every((v) => v === null || typeof v !== 'object')) return parsed
  } catch {
    // fall through to the lenient split below
  }
  if (/[[\]{}]/.test(inner)) throw new Error('Only flat arrays are supported')
  return inner.split(',').map((part) => {
    const token = part.trim().replace(/^['"]|['"]$/g, '')
    if (token === '') throw new Error('Empty element (check for a stray comma)')
    return token !== '' && !Number.isNaN(Number(token)) ? Number(token) : token
  })
}
