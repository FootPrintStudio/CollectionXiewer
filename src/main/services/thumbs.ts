import { pixelRect } from '../../shared/cropRect'
import { getSharp } from '../lib/lazyNative'
import { heicToJpeg, readHeicDimensions } from '../lib/heicImage'
import { exoticRasterToJpeg, readExoticRasterDimensions } from '../lib/rasterFormats'
import { isExoticRasterPath, isHeicPath } from '../../shared/rasterExtensions'
import { persistExoticRasterDimensions } from './exoticRasterDimensions'
import { rasterizeMotionFirstFrame } from '../lib/motionFrame'
import { imageDimensionsFromMetadata, isMotionMedia, sharpReadOptions } from '../lib/sharpMotion'
import { getCrop } from './crop'
import type { CropRect, MediaKind } from '../../shared/types'
import { getPosterTimeMs, readPosterFile } from './videoPoster'
import { probeVideoStream, videoThumbnailToJpeg } from '../lib/videoThumb'

const lru = new Map<string, { buf: Buffer; at: number }>()
const MAX_CACHE = 200

function cacheKey(
  path: string,
  size: number,
  crop?: CropRect | null,
  videoSeekMs?: number | null
): string {
  const seekPart = videoSeekMs != null ? `:seek${videoSeekMs}` : ''
  const base = `motion-v6:${path}:${size}${seekPart}`
  if (!crop) return base
  return `${base}:${crop.x},${crop.y},${crop.w},${crop.h}`
}

function evict(): void {
  if (lru.size <= MAX_CACHE) return
  const sorted = [...lru.entries()].sort((a, b) => a[1].at - b[1].at)
  for (let i = 0; i < sorted.length - MAX_CACHE; i++) {
    lru.delete(sorted[i][0])
  }
}

function store(key: string, buf: Buffer): Buffer {
  lru.set(key, { buf, at: Date.now() })
  evict()
  return buf
}

async function sharpThumbnail(
  absolutePath: string,
  maxSize: number,
  kind: MediaKind | undefined,
  crop: CropRect | null
): Promise<Buffer> {
  const sharp = getSharp()
  const readOpts = sharpReadOptions(absolutePath, kind)
  let pipeline = sharp(absolutePath, readOpts)

  if (crop) {
    const meta = await sharp(absolutePath, readOpts).metadata()
    const dims = imageDimensionsFromMetadata(meta)
    const W = dims.width ?? 1
    const H = dims.height ?? 1
    const px = pixelRect(crop, W, H)
    pipeline = pipeline.extract(px)
  }

  return pipeline
    .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer()
}

export async function generateThumbnail(
  absolutePath: string,
  maxSize: number,
  mediaId?: number,
  kind?: MediaKind
): Promise<Buffer | null> {
  const crop = mediaId ? getCrop(mediaId) : null
  const videoSeekMs =
    kind === 'video' && mediaId ? getPosterTimeMs(mediaId) : null
  const key = cacheKey(absolutePath, maxSize, crop, videoSeekMs)
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
      return store(key, buf)
    }
  }

  if (isMotionMedia(kind, absolutePath) && !crop) {
    const motionBuf = await rasterizeMotionFirstFrame(absolutePath, maxSize)
    if (motionBuf) return store(key, motionBuf)
    return null
  }

  if (isHeicPath(absolutePath)) {
    if (mediaId) {
      const dims = await readHeicDimensions(absolutePath)
      if (dims) persistExoticRasterDimensions(mediaId, dims.width, dims.height)
    }
    const buf = await heicToJpeg(absolutePath, maxSize, crop)
    if (buf) return store(key, buf)
    return null
  }

  if (isExoticRasterPath(absolutePath)) {
    if (mediaId) {
      const dims = await readExoticRasterDimensions(absolutePath)
      if (dims) persistExoticRasterDimensions(mediaId, dims.width, dims.height)
    }
    const buf = await exoticRasterToJpeg(absolutePath, maxSize, crop)
    if (buf) return store(key, buf)
    return null
  }

  if (kind === 'video' && !crop) {
    if (mediaId) {
      const probe = await probeVideoStream(absolutePath)
      if (probe) persistExoticRasterDimensions(mediaId, probe.width, probe.height)
    }
    const seekSeconds =
      videoSeekMs != null && videoSeekMs >= 0 ? videoSeekMs / 1000 : undefined
    const buf = await videoThumbnailToJpeg(absolutePath, maxSize, seekSeconds)
    if (buf) return store(key, buf)
    return null
  }

  try {
    const buf = await sharpThumbnail(absolutePath, maxSize, kind, crop)
    return store(key, buf)
  } catch (err) {
    console.warn('[thumb] failed:', absolutePath, err instanceof Error ? err.message : err)
    return null
  }
}

export async function generatePreviewBuffer(
  absolutePath: string,
  maxDim: number,
  mediaId?: number,
  kind?: MediaKind
): Promise<Buffer | null> {
  return generateThumbnail(absolutePath, maxDim, mediaId, kind)
}
