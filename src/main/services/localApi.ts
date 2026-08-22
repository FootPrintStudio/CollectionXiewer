import { app } from 'electron'
import { createReadStream, existsSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { basename, extname } from 'node:path'
import { parseSearchQuery } from '../../shared/searchParser'
import type { MediaItem, MediaSortOrder } from '../../shared/types'
import { MEDIA_SORT_ORDERS } from '../../shared/mediaSort'
import { buildSearchResolveContext } from './identifiers'
import * as mediaQuery from './mediaQuery'

export const LOCAL_API_HOST = '127.0.0.1'
export const LOCAL_API_PORT = 47821

let server: Server | null = null

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*'
  })
  res.end(payload)
}

function sendText(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  })
  res.end(message)
}

function parsePositiveInt(value: string | null, fallback: number, max = 5000): number {
  if (value == null || value.trim() === '') return fallback
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(n, max)
}

function parseSortOrder(value: string | null): MediaSortOrder | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase() as MediaSortOrder
  return MEDIA_SORT_ORDERS.includes(normalized) ? normalized : undefined
}

function mimeForPath(filePath: string, mime: string | null): string {
  if (mime) return mime
  const ext = extname(filePath).toLowerCase()
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.mov':
      return 'video/quicktime'
    default:
      return 'application/octet-stream'
  }
}

function toSearchItem(item: MediaItem) {
  return {
    id: item.id,
    path: item.absolute_path,
    name: basename(item.relative_path),
    relative_path: item.relative_path,
    kind: item.kind,
    mtime: item.mtime,
    indexed_at: item.indexed_at,
    width: item.width,
    height: item.height,
    mime: item.mime
  }
}

function handleSearch(url: URL, res: ServerResponse): void {
  const q = url.searchParams.get('q')?.trim() ?? ''
  if (!q) {
    sendJson(res, 400, { ok: false, error: 'Missing required query parameter q.' })
    return
  }

  const limit = parsePositiveInt(url.searchParams.get('limit'), 500)
  const offset = parsePositiveInt(url.searchParams.get('offset'), 0)
  const sortParam = url.searchParams.get('sort')
  const sortOrder = parseSortOrder(sortParam)
  if (sortParam && !sortOrder) {
    sendJson(res, 400, {
      ok: false,
      error: `Unknown sort "${sortParam}". Use one of: ${MEDIA_SORT_ORDERS.join(', ')}`
    })
    return
  }

  const ctx = buildSearchResolveContext()
  const { ast, errors } = parseSearchQuery(q, ctx)
  if (errors.length > 0) {
    sendJson(res, 400, {
      ok: false,
      error: errors[0]!.message,
      errors: errors.map((e) => ({ message: e.message, offset: e.offset }))
    })
    return
  }

  const items = mediaQuery.runSearchAst(ast, limit, offset, { sortOrder }).map(toSearchItem)
  sendJson(res, 200, {
    ok: true,
    query: q,
    limit,
    offset,
    sort: sortOrder ?? null,
    count: items.length,
    items
  })
}

function handleFile(idRaw: string, res: ServerResponse): void {
  const id = Number.parseInt(idRaw, 10)
  if (!Number.isFinite(id) || id <= 0) {
    sendText(res, 400, 'Invalid media id.')
    return
  }

  const media = mediaQuery.getMedia(id)
  if (!media || media.missing) {
    sendText(res, 404, 'Media not found.')
    return
  }

  if (!existsSync(media.absolute_path)) {
    sendText(res, 404, 'Media file missing on disk.')
    return
  }

  const contentType = mimeForPath(media.absolute_path, media.mime)
  res.writeHead(200, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'private, max-age=60'
  })
  createReadStream(media.absolute_path).pipe(res)
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    })
    res.end()
    return
  }

  if (req.method !== 'GET') {
    sendText(res, 405, 'Method not allowed.')
    return
  }

  const host = req.headers.host ?? `${LOCAL_API_HOST}:${LOCAL_API_PORT}`
  let url: URL
  try {
    url = new URL(req.url ?? '/', `http://${host}`)
  } catch {
    sendText(res, 400, 'Bad request URL.')
    return
  }

  if (url.pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      version: app.getVersion(),
      service: 'CollectionXiewer'
    })
    return
  }

  if (url.pathname === '/search') {
    try {
      handleSearch(url, res)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      sendJson(res, 500, { ok: false, error: message })
    }
    return
  }

  const fileMatch = /^\/file\/(\d+)$/.exec(url.pathname)
  if (fileMatch?.[1]) {
    try {
      handleFile(fileMatch[1], res)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      sendText(res, 500, message)
    }
    return
  }

  sendText(res, 404, 'Not found.')
}

export function startLocalApi(): void {
  if (server) return

  server = createServer(handleRequest)
  server.on('error', (err) => {
    console.error(`[CollectionXiewer] Local API failed to bind ${LOCAL_API_HOST}:${LOCAL_API_PORT}:`, err)
  })
  server.listen(LOCAL_API_PORT, LOCAL_API_HOST, () => {
    console.log(`[CollectionXiewer] Local API listening on http://${LOCAL_API_HOST}:${LOCAL_API_PORT}`)
  })
}

export function stopLocalApi(): void {
  if (!server) return
  const current = server
  server = null
  current.close()
}
