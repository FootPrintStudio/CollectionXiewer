import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { getDb } from '../db/database'

function postersDir(): string {
  const dir = join(app.getPath('home'), '.config', 'CollectionXiewer', 'posters')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function posterFilePath(mediaId: number): string {
  return join(postersDir(), `${mediaId}.jpg`)
}

export function hasPoster(mediaId: number): boolean {
  return existsSync(posterFilePath(mediaId))
}

export function getPosterTimeMs(mediaId: number): number | null {
  const row = getDb()
    .prepare(`SELECT time_ms FROM media_poster WHERE media_id = ?`)
    .get(mediaId) as { time_ms: number } | undefined
  return row?.time_ms ?? null
}

export function setPoster(mediaId: number, jpeg: Buffer, timeMs: number): void {
  const now = new Date().toISOString()
  writeFileSync(posterFilePath(mediaId), jpeg)
  getDb()
    .prepare(
      `INSERT INTO media_poster (media_id, time_ms, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(media_id) DO UPDATE SET time_ms = excluded.time_ms, updated_at = excluded.updated_at`
    )
    .run(mediaId, timeMs, now)
}

export function clearPoster(mediaId: number): void {
  const path = posterFilePath(mediaId)
  if (existsSync(path)) unlinkSync(path)
  getDb().prepare(`DELETE FROM media_poster WHERE media_id = ?`).run(mediaId)
}

export function readPosterFile(mediaId: number): Buffer | null {
  const path = posterFilePath(mediaId)
  if (!existsSync(path)) return null
  return readFileSync(path)
}
