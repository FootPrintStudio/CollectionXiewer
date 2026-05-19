import { getDb } from '../db/database'
import { readHeicDimensions } from '../lib/heicImage'
import { readExoticRasterDimensions } from '../lib/rasterFormats'
import { probeVideoStream } from '../lib/videoThumb'
import { isDecoderImagePath, isExoticRasterPath, isHeicPath } from '../../shared/rasterExtensions'
import type { MediaItem } from '../../shared/types'

async function readDecoderImageDimensions(
  item: MediaItem
): Promise<{ width: number; height: number; durationMs?: number | null } | null> {
  if (item.kind === 'video') {
    const probe = await probeVideoStream(item.absolute_path)
    return probe
      ? { width: probe.width, height: probe.height, durationMs: probe.durationMs }
      : null
  }
  if (isHeicPath(item.absolute_path)) return readHeicDimensions(item.absolute_path)
  if (isExoticRasterPath(item.absolute_path)) return readExoticRasterDimensions(item.absolute_path)
  return null
}

/** Fill missing width/height for decoder images (BMP/TGA/HEIC) and persist to SQLite. */
function needsDimensionBackfill(item: MediaItem): boolean {
  if (item.width && item.height) return false
  return item.kind === 'video' || isDecoderImagePath(item.absolute_path)
}

export async function backfillExoticRasterDimensions(
  items: MediaItem[]
): Promise<MediaItem[]> {
  const needs = items.filter(needsDimensionBackfill)
  if (needs.length === 0) return items

  const db = getDb()
  const stmt = db.prepare(
    `UPDATE media_items SET width = ?, height = ?, duration_ms = COALESCE(?, duration_ms)
     WHERE id = ? AND (width IS NULL OR height IS NULL)`
  )
  const patched = new Map<
    number,
    { width: number; height: number; durationMs: number | null }
  >()

  for (const item of needs) {
    const dims = await readDecoderImageDimensions(item)
    if (!dims) continue
    stmt.run(dims.width, dims.height, dims.durationMs ?? null, item.id)
    patched.set(item.id, {
      width: dims.width,
      height: dims.height,
      durationMs: dims.durationMs ?? item.duration_ms
    })
  }

  if (patched.size === 0) return items
  return items.map((item) => {
    const dims = patched.get(item.id)
    return dims
      ? {
          ...item,
          width: dims.width,
          height: dims.height,
          duration_ms: dims.durationMs ?? item.duration_ms
        }
      : item
  })
}

export async function backfillExoticRasterDimension(
  item: MediaItem | null
): Promise<MediaItem | null> {
  if (!item) return null
  const [out] = await backfillExoticRasterDimensions([item])
  return out ?? null
}

export function persistExoticRasterDimensions(
  mediaId: number,
  width: number,
  height: number
): void {
  getDb()
    .prepare(
      `UPDATE media_items SET width = ?, height = ? WHERE id = ? AND (width IS NULL OR height IS NULL)`
    )
    .run(width, height, mediaId)
}
