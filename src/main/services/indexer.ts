import { stat } from 'node:fs/promises'
import { extname, relative } from 'node:path'
import mime from 'mime-types'
import sharp from 'sharp'
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
  '.apng'
])
const MOTION_EXTS = new Set(['.gif', '.webp', '.apng', '.png'])
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
    return { mime: mimeType, kind: MOTION_EXTS.has(ext) ? 'motion' : 'image' }
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
  const { kind, mime: mimeType } = classifyFile(absoluteFilePath)
  if (kind === 'unknown') return null

  const rel = relative(rootPath, absoluteFilePath)
  if (rel.startsWith('..')) return null

  const st = await stat(absoluteFilePath)
  let width: number | null = null
  let height: number | null = null

  if (kind === 'image' || kind === 'motion') {
    try {
      const meta = await sharp(absoluteFilePath, { animated: kind === 'motion' }).metadata()
      width = meta.width ?? null
      height = meta.height ?? null
    } catch {
      /* TGA or exotic — keep null dimensions */
    }
  }

  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO media_items (root_id, relative_path, mime, kind, width, height, duration_ms, mtime, indexed_at, missing)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, 0)
     ON CONFLICT(root_id, relative_path) DO UPDATE SET
       mime = excluded.mime,
       kind = excluded.kind,
       width = excluded.width,
       height = excluded.height,
       mtime = excluded.mtime,
       indexed_at = excluded.indexed_at,
       missing = 0`
  ).run(rootId, rel, mimeType, kind, width, height, st.mtimeMs, now)

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
