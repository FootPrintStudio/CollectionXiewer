import { stat } from 'node:fs/promises'
import { extname, relative } from 'node:path'
import mime from 'mime-types'
import { getSharp } from '../lib/lazyNative'
import { readGifLogicalSize } from '../lib/motionFrame'
import { readHeicDimensions } from '../lib/heicImage'
import { readExoticRasterDimensions } from '../lib/rasterFormats'
import { isExoticRasterPath, isHeicPath } from '../../shared/rasterExtensions'
import { imageDimensionsFromMetadata } from '../lib/sharpMotion'
import { probeVideoStream } from '../lib/videoThumb'
import { getDb } from '../db/database'
import type { MediaKind, MediaItem } from '../../shared/types'
import { enrichMedia } from './mediaPaths'

const IMAGE_EXTS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.bmp',
  '.gif',
  '.tga',
  '.heic',
  '.heif',
  '.apng'
])
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mkv', '.mov', '.avi', '.m4v'])

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.cache',
  'CollectionXiewer'
])

export function shouldSkipDir(name: string): boolean {
  return SKIP_DIRS.has(name) || name.startsWith('.')
}

export function classifyFile(filePath: string): { mime: string | null; kind: MediaKind } {
  const ext = extname(filePath).toLowerCase()
  const mimeType = (mime.lookup(filePath) as string | false) || null

  if (VIDEO_EXTS.has(ext)) return { mime: mimeType ?? `video/${ext.slice(1)}`, kind: 'video' }
  if (ext === '.gif' || ext === '.apng') return { mime: mimeType, kind: 'motion' }
  if (ext === '.webp' || ext === '.png') {
    return { mime: mimeType, kind: 'image' }
  }
  if (IMAGE_EXTS.has(ext) || (mimeType?.startsWith('image/') ?? false)) {
    return { mime: mimeType, kind: 'image' }
  }
  return { mime: mimeType, kind: 'unknown' }
}

export async function indexFile(
  rootId: number,
  rootPath: string,
  absoluteFilePath: string
): Promise<MediaItem | null> {
  let { kind, mime: mimeType } = classifyFile(absoluteFilePath)
  if (kind === 'unknown') return null

  const rel = relative(rootPath, absoluteFilePath)
  if (rel.startsWith('..')) return null

  const st = await stat(absoluteFilePath)
  let width: number | null = null
  let height: number | null = null
  let durationMs: number | null = null

  if (kind === 'video') {
    const probe = await probeVideoStream(absoluteFilePath)
    if (probe) {
      width = probe.width
      height = probe.height
      durationMs = probe.durationMs
    }
  } else if (kind === 'image' || kind === 'motion') {
    try {
      const ext = extname(absoluteFilePath).toLowerCase()
      if (ext === '.gif') {
        const gifSize = readGifLogicalSize(absoluteFilePath)
        if (gifSize) {
          width = gifSize.width
          height = gifSize.height
        }
      } else if (isHeicPath(absoluteFilePath)) {
        const dims = await readHeicDimensions(absoluteFilePath)
        if (dims) {
          width = dims.width
          height = dims.height
        }
      } else if (isExoticRasterPath(absoluteFilePath)) {
        const dims = await readExoticRasterDimensions(absoluteFilePath)
        if (dims) {
          width = dims.width
          height = dims.height
        }
      } else {
        const useAnimated = kind === 'motion' || ext === '.webp' || ext === '.png'
        const meta = await getSharp()(absoluteFilePath, useAnimated ? { animated: true } : {}).metadata()
        const dims = imageDimensionsFromMetadata(meta)
        width = dims.width
        height = dims.height
        if (kind === 'image' && dims.pages > 1) kind = 'motion'
      }
    } catch {
      /* unsupported — keep null dimensions */
    }
  }

  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO media_items (root_id, relative_path, mime, kind, width, height, duration_ms, mtime, indexed_at, missing)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(root_id, relative_path) DO UPDATE SET
       mime = excluded.mime,
       kind = excluded.kind,
       width = excluded.width,
       height = excluded.height,
       duration_ms = excluded.duration_ms,
       mtime = excluded.mtime,
       indexed_at = excluded.indexed_at,
       missing = 0`
  ).run(rootId, rel, mimeType, kind, width, height, durationMs, st.mtimeMs, now)

  const row = db
    .prepare(
      `SELECT id, root_id, relative_path, mime, kind, width, height, duration_ms, mtime, indexed_at, missing
       FROM media_items WHERE root_id = ? AND relative_path = ?`
    )
    .get(rootId, rel) as Omit<MediaItem, 'absolute_path'>

  return enrichMedia(row, rootPath)
}

export function markMissing(rootId: number, relativePath: string): void {
  getDb()
    .prepare(`UPDATE media_items SET missing = 1 WHERE root_id = ? AND relative_path = ?`)
    .run(rootId, relativePath)
}

export function removeMedia(rootId: number, relativePath: string): void {
  getDb()
    .prepare(`DELETE FROM media_items WHERE root_id = ? AND relative_path = ?`)
    .run(rootId, relativePath)
}
