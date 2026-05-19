import sharp from 'sharp'
import { getDb } from '../db/database'
import type { CropRect, MediaCrop } from '../../shared/types'

export function getCrop(mediaId: number): MediaCrop | null {
  return (
    (getDb().prepare(`SELECT * FROM media_crop WHERE media_id = ?`).get(mediaId) as MediaCrop) ?? null
  )
}

export function setCrop(mediaId: number, rect: CropRect): MediaCrop {
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO media_crop (media_id, x, y, w, h, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(media_id) DO UPDATE SET x=excluded.x, y=excluded.y, w=excluded.w, h=excluded.h, updated_at=excluded.updated_at`
    )
    .run(mediaId, rect.x, rect.y, rect.w, rect.h, now)
  return getCrop(mediaId)!
}

export function clearCrop(mediaId: number): void {
  getDb().prepare(`DELETE FROM media_crop WHERE media_id = ?`).run(mediaId)
}

export async function exportCropped(
  absolutePath: string,
  rect: CropRect,
  outPath: string
): Promise<void> {
  const meta = await sharp(absolutePath).metadata()
  const W = meta.width ?? 1
  const H = meta.height ?? 1
  const left = Math.round(rect.x * W)
  const top = Math.round(rect.y * H)
  const width = Math.max(1, Math.round(rect.w * W))
  const height = Math.max(1, Math.round(rect.h * H))
  await sharp(absolutePath)
    .extract({ left, top, width, height })
    .toFile(outPath)
}

export function pixelRect(rect: CropRect, width: number, height: number) {
  return {
    left: Math.round(rect.x * width),
    top: Math.round(rect.y * height),
    width: Math.max(1, Math.round(rect.w * width)),
    height: Math.max(1, Math.round(rect.h * height))
  }
}
