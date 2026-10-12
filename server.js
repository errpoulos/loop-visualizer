// Minimal static server for the production build (used by `npm start`, e.g. on Heroku).
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const port = Number(process.env.PORT) || 3000

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0])
  const file = normalize(join(root, decoded))
  if (file !== root && !file.startsWith(root + sep)) return null
  try {
    if ((await stat(file)).isFile()) return file
  } catch {
    // fall through to index.html
  }
  return join(root, 'index.html')
}

createServer(async (req, res) => {
  const file = await resolveFile(req.url ?? '/').catch(() => null)
  if (!file) {
    res.writeHead(400).end('Bad request')
    return
  }
  const hashedAsset = file.includes(`${sep}assets${sep}`)
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': hashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(file).on('error', () => res.destroy()).pipe(res)
}).listen(port, () => console.log(`Serving dist/ on port ${port}`))
