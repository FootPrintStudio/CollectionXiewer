import { pixelRect } from '../../shared/cropRect'
import { getSharp } from '../lib/lazyNative'
import { exportHeicCrop } from '../lib/heicImage'
import { exportExoticRasterCrop } from '../lib/rasterFormats'
import { isExoticRasterPath, isHeicPath } from '../../shared/rasterExtensions'
import { imageDimensionsFromMetadata, sharpReadOptions } from '../lib/sharpMotion'
import { getDb } from '../db/database'
import type { CropRect, MediaCrop, MediaKind } from '../../shared/types'

export { pixelRect } from '../../shared/cropRect'

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
  outPath: string,
  kind?: MediaKind
): Promise<void> {
  if (isHeicPath(absolutePath)) {
    await exportHeicCrop(absolutePath, rect, outPath)
    return
  }

  if (isExoticRasterPath(absolutePath)) {
    await exportExoticRasterCrop(absolutePath, rect, outPath)
    return
  }

  const sharp = getSharp()
  const readOpts = sharpReadOptions(absolutePath, kind)
  const meta = await sharp(absolutePath, readOpts).metadata()
  const dims = imageDimensionsFromMetadata(meta)
  const W = dims.width ?? 1
  const H = dims.height ?? 1
  const px = pixelRect(rect, W, H)
  await sharp(absolutePath, readOpts).extract(px).toFile(outPath)
}
