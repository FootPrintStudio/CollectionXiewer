import { randomUUID } from 'node:crypto'
import { rename, unlink } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { pixelRect, transformRegionAfterCrop, validateCropRect } from '../../shared/cropRect'
import { subjectRegion } from '../../shared/subjects'
import { getSharp } from '../lib/lazyNative'
import { exportHeicCrop } from '../lib/heicImage'
import { exportExoticRasterCrop } from '../lib/rasterFormats'
import { isExoticRasterPath, isHeicPath } from '../../shared/rasterExtensions'
import { imageDimensionsFromMetadata, sharpReadOptions } from '../lib/sharpMotion'
import { getDb } from '../db/database'
import type { CropRect, MediaCrop, MediaItem, MediaKind, Subject } from '../../shared/types'
import { indexFile } from './indexer'
import { getMedia } from './mediaQuery'
import { invalidateThumbnailCache } from './thumbs'
import { listSubjects, updateSubject } from './tags'

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

function transformSubjectRegionsAfterCrop(mediaId: number, crop: CropRect): void {
  for (const subject of listSubjects(mediaId) as Subject[]) {
    const region = subjectRegion(subject)
    if (!region) continue
    const transformed = transformRegionAfterCrop(region, crop)
    updateSubject(subject.id, { region: transformed })
  }
}

/** Write cropped pixels back to the original file and re-index. */
export async function applyCropToOriginal(mediaId: number, rect: CropRect): Promise<MediaItem> {
  const media = getMedia(mediaId)
  if (!media) throw new Error('No media')
  if (media.kind !== 'image' && media.kind !== 'motion') {
    throw new Error('Only still and motion images can be cropped.')
  }

  const validated = validateCropRect(rect)
  const ext = extname(media.absolute_path) || '.jpg'
  const tmp = join(tmpdir(), `cx-crop-${randomUUID()}${ext}`)

  try {
    await exportCropped(media.absolute_path, validated, tmp, media.kind)
    await rename(tmp, media.absolute_path)
  } catch (err) {
    await unlink(tmp).catch(() => {})
    throw err
  }

  transformSubjectRegionsAfterCrop(mediaId, validated)
  clearCrop(mediaId)
  invalidateThumbnailCache(media.absolute_path)

  const root = getDb()
    .prepare(`SELECT id, path FROM watch_roots WHERE id = ?`)
    .get(media.root_id) as { id: number; path: string }
  const item = await indexFile(root.id, root.path, media.absolute_path)
  if (!item) throw new Error('Could not re-index cropped file.')
  return item
}

/** Bake legacy virtual crops into files on disk. */
export async function migrateVirtualCrops(): Promise<void> {
  const rows = getDb()
    .prepare(`SELECT media_id, x, y, w, h FROM media_crop`)
    .all() as Array<{ media_id: number; x: number; y: number; w: number; h: number }>

  for (const row of rows) {
    try {
      await applyCropToOriginal(row.media_id, {
        x: row.x,
        y: row.y,
        w: row.w,
        h: row.h
      })
    } catch (err) {
      console.warn(
        `[crop] could not migrate virtual crop for media ${row.media_id}:`,
        err instanceof Error ? err.message : err
      )
    }
  }
}
