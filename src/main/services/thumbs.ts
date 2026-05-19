import { getSharp } from '../lib/lazyNative'
import { getCrop, pixelRect } from './crop'
import type { CropRect } from '../../shared/types'
import { readPosterFile } from './videoPoster'

const lru = new Map<string, { buf: Buffer; at: number }>()
const MAX_CACHE = 200

function cacheKey(path: string, size: number, crop?: CropRect | null): string {
  if (!crop) return `${path}:${size}`
  return `${path}:${size}:${crop.x},${crop.y},${crop.w},${crop.h}`
}

function evict(): void {
  if (lru.size <= MAX_CACHE) return
  const sorted = [...lru.entries()].sort((a, b) => a[1].at - b[1].at)
  for (let i = 0; i < sorted.length - MAX_CACHE; i++) {
    lru.delete(sorted[i][0])
  }
}

export async function generateThumbnail(
  absolutePath: string,
  maxSize: number,
  mediaId?: number
): Promise<Buffer> {
  const crop = mediaId ? getCrop(mediaId) : null
  const key = cacheKey(absolutePath, maxSize, crop)
  const hit = lru.get(key)
  if (hit) {
    hit.at = Date.now()
    return hit.buf
  }

  if (mediaId) {
    const poster = readPosterFile(mediaId)
    if (poster) {
      const buf = await getSharp()(poster)
        .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer()
      lru.set(key, { buf, at: Date.now() })
      evict()
      return buf
    }
  }

  const sharp = getSharp()
  let pipeline = sharp(absolutePath, { animated: absolutePath.toLowerCase().endsWith('.gif') })

  if (crop) {
    const meta = await sharp(absolutePath).metadata()
    const W = meta.width ?? 1
    const H = meta.height ?? 1
    const px = pixelRect(crop, W, H)
    pipeline = pipeline.extract(px)
  }

  const buf = await pipeline
    .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer()

  lru.set(key, { buf, at: Date.now() })
  evict()
  return buf
}

export async function generatePreviewBuffer(
  absolutePath: string,
  maxDim: number,
  mediaId?: number
): Promise<Buffer> {
  return generateThumbnail(absolutePath, maxDim, mediaId)
}
