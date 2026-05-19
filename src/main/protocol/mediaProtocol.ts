import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { protocol } from 'electron'
import mime from 'mime-types'
import { MEDIA_SCHEME } from '../../shared/mediaProtocol'

export { MEDIA_SCHEME }

/** Call once before app.ready. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        bypassCSP: true,
        stream: true,
        corsEnabled: true
      }
    }
  ])
}

function parseByteRange(
  rangeHeader: string | null,
  size: number
): { start: number; end: number } | 'unsatisfiable' | null {
  if (!rangeHeader?.startsWith('bytes=')) return null
  const [startStr, endStr] = rangeHeader.slice(6).split('-', 2)
  let start = startStr ? Number.parseInt(startStr, 10) : 0
  let end = endStr ? Number.parseInt(endStr, 10) : size - 1
  if (Number.isNaN(start)) start = 0
  if (Number.isNaN(end)) end = size - 1
  if (start < 0) start = 0
  if (end >= size) end = size - 1
  if (start > end || start >= size) return 'unsatisfiable'
  return { start, end }
}

function mediaHeaders(filePath: string, size: number): Record<string, string> {
  const mimeType = (mime.lookup(filePath) as string | false) || 'application/octet-stream'
  return {
    'Accept-Ranges': 'bytes',
    'Content-Length': String(size),
    'Content-Type': mimeType
  }
}

/** Call from app.whenReady before creating windows. */
export function installMediaProtocolHandler(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const filePath = new URL(request.url).searchParams.get('path')
    if (!filePath) return new Response('Missing path', { status: 400 })

    let fileStat: Awaited<ReturnType<typeof stat>>
    try {
      fileStat = await stat(filePath)
    } catch {
      return new Response('Not found', { status: 404 })
    }

    const size = fileStat.size
    const baseHeaders = mediaHeaders(filePath, size)

    if (request.method === 'HEAD') {
      return new Response(null, { status: 200, headers: baseHeaders })
    }

    const range = parseByteRange(request.headers.get('Range'), size)

    if (range === 'unsatisfiable') {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` }
      })
    }

    if (range) {
      const { start, end } = range
      const chunkSize = end - start + 1
      const stream = createReadStream(filePath, { start, end })
      return new Response(stream as unknown as ReadableStream, {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Length': String(chunkSize),
          'Content-Range': `bytes ${start}-${end}/${size}`
        }
      })
    }

    const stream = createReadStream(filePath)
    return new Response(stream as unknown as ReadableStream, {
      status: 200,
      headers: baseHeaders
    })
  })
}
