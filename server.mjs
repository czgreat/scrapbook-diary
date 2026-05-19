import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, 'dist')
const port = Number(process.env.PORT || '80')
const blockedAgents =
  /(ahrefs|amazonbot|blexbot|bytespider|curl|dotbot|go-http-client|httpclient|java|mj12bot|python|scrapy|semrush|spbot|wget)/i
const requestBuckets = new Map()
const WINDOW_MS = 10_000
const MAX_REQUESTS = 120

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
])

function getClientIp(request) {
  const forwarded = request.headers['x-forwarded-for']

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }

  return request.socket.remoteAddress || 'unknown'
}

function defaultHeaders() {
  return {
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:;",
  }
}

function isRateLimited(clientIp) {
  const now = Date.now()
  const previous = requestBuckets.get(clientIp) || []
  const recent = previous.filter((time) => now - time < WINDOW_MS)

  recent.push(now)
  requestBuckets.set(clientIp, recent)

  return recent.length > MAX_REQUESTS
}

function safePathname(rawUrl) {
  const requestUrl = new URL(rawUrl || '/', 'http://127.0.0.1')
  return decodeURIComponent(requestUrl.pathname)
}

const server = http.createServer((request, response) => {
  const userAgent = request.headers['user-agent'] || ''
  const clientIp = getClientIp(request)
  const headers = defaultHeaders()

  if (typeof userAgent !== 'string' || userAgent.length === 0 || blockedAgents.test(userAgent)) {
    response.writeHead(403, headers)
    response.end('Forbidden')
    return
  }

  if (isRateLimited(clientIp)) {
    response.writeHead(429, {
      ...headers,
      'Retry-After': '10',
    })
    response.end('Too Many Requests')
    return
  }

  const pathname = safePathname(request.url)

  if (pathname.includes('\0') || pathname.includes('..')) {
    response.writeHead(400, headers)
    response.end('Bad Request')
    return
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1)
  let filePath = path.join(distDir, relativePath)

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html')
  }

  const extension = path.extname(filePath)
  const contentType = mimeTypes.get(extension) || 'application/octet-stream'
  const finalHeaders = {
    ...headers,
    'Content-Type': contentType,
  }

  if (request.method === 'HEAD') {
    response.writeHead(200, finalHeaders)
    response.end()
    return
  }

  response.writeHead(200, finalHeaders)
  createReadStream(filePath).pipe(response)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`scrapbook diary listening on ${port}`)
})
