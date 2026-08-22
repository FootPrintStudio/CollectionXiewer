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

/** ~64 MiB byte budget for in-memory thumb/preview JPEGs. */
const MAX_CACHE_BYTES = 64 * 1024 * 1024

/** Insertion-order Map: oldest at front; on hit, re-insert at end (O(1) LRU). */
const lru = new Map<string, Buffer>()
let cacheBytes = 0
const inflight = new Map<string, Promise<Buffer | null>>()

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

function lruGet(key: string): Buffer | undefined {
  const hit = lru.get(key)
  if (!hit) return undefined
  lru.delete(key)
  lru.set(key, hit)
  return hit
}

function lruSet(key: string, buf: Buffer): Buffer {
  const prev = lru.get(key)
  if (prev) {
    cacheBytes -= prev.length
    lru.delete(key)
  }
  lru.set(key, buf)
  cacheBytes += buf.length
  while (cacheBytes > MAX_CACHE_BYTES && lru.size > 0) {
    const oldest = lru.keys().next().value as string
    const victim = lru.get(oldest)
    lru.delete(oldest)
    if (victim) cacheBytes -= victim.length
  }
  return buf
}

export function invalidateThumbnailCache(absolutePath: string): void {
  for (const key of [...lru.keys()]) {
    if (key.includes(absolutePath)) {
      const buf = lru.get(key)
      lru.delete(key)
      if (buf) cacheBytes -= buf.length
    }
  }
  for (const key of [...inflight.keys()]) {
    if (key.includes(absolutePath)) inflight.delete(key)
  }
}

function store(key: string, buf: Buffer): Buffer {
  return lruSet(key, buf)
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

async function generateThumbnailUncached(
  absolutePath: string,
  maxSize: number,
  mediaId: number | undefined,
  kind: MediaKind | undefined,
  crop: CropRect | null,
  videoSeekMs: number | null,
  key: string
): Promise<Buffer | null> {
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

export async function generateThumbnail(
  absolutePath: string,
  maxSize: number,
  mediaId?: number,
  kind?: MediaKind,
  options?: { skipCrop?: boolean }
): Promise<Buffer | null> {
  const crop = mediaId && !options?.skipCrop ? getCrop(mediaId) : null
  const videoSeekMs =
    kind === 'video' && mediaId ? getPosterTimeMs(mediaId) : null
  const key = cacheKey(absolutePath, maxSize, crop, videoSeekMs)
  const hit = lruGet(key)
  if (hit) return hit

  const pending = inflight.get(key)
  if (pending) return pending

  const promise = generateThumbnailUncached(
    absolutePath,
    maxSize,
    mediaId,
    kind,
    crop,
    videoSeekMs,
    key
  ).finally(() => {
    inflight.delete(key)
  })
  inflight.set(key, promise)
  return promise
}

export async function generatePreviewBuffer(
  absolutePath: string,
  maxDim: number,
  mediaId?: number,
  kind?: MediaKind,
  options?: { skipCrop?: boolean }
): Promise<Buffer | null> {
  return generateThumbnail(absolutePath, maxDim, mediaId, kind, options)
}
