import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { decompressFrames, parseGIF, type ParsedFrame } from 'gifuct-js'
import { getSharp } from './lazyNative'

function frameContentScore(frame: ParsedFrame): number {
  const patch = frame.patch
  let sum = 0
  for (let i = 0; i < patch.length; i += 4) {
    if (patch[i + 3] < 32) continue
    sum += patch[i] + patch[i + 1] + patch[i + 2]
  }
  return sum
}

export function readGifLogicalSize(
  absolutePath: string
): { width: number; height: number } | null {
  try {
    const data = new Uint8Array(readFileSync(absolutePath))
    const gif = parseGIF(data.buffer)
    const { width, height } = gif.lsd
    if (!width || !height) return null
    return { width, height }
  } catch {
    return null
  }
}

function pickBestGifFrame(frames: ParsedFrame[]): ParsedFrame {
  let best = frames[0]
  let bestScore = frameContentScore(frames[0])
  for (let i = 1; i < frames.length; i++) {
    const score = frameContentScore(frames[i])
    if (score > bestScore) {
      best = frames[i]
      bestScore = score
    }
  }
  return best
}

async function rasterizeGifWithGifuct(absolutePath: string, maxSize: number): Promise<Buffer | null> {
  const data = new Uint8Array(readFileSync(absolutePath))
  const frames = decompressFrames(parseGIF(data.buffer), true)
  if (!frames.length) return null

  const frame = pickBestGifFrame(frames)
  const patch = frame.dims
  const canvas = readGifLogicalSize(absolutePath) ?? patch
  const width = canvas.width
  const height = canvas.height
  if (!width || !height) return null

  const rgba = new Uint8Array(frame.patch)
  return getSharp()(Buffer.from(rgba), {
    raw: { width: patch.width, height: patch.height, channels: 4 }
  })
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer()
}

/** Static JPEG thumbnail for motion images (GIF / animated WebP / APNG). */
export async function rasterizeMotionFirstFrame(
  absolutePath: string,
  maxSize: number
): Promise<Buffer | null> {
  const ext = extname(absolutePath).toLowerCase()

  if (ext === '.gif') {
    try {
      return await rasterizeGifWithGifuct(absolutePath, maxSize)
    } catch {
      /* fall through */
    }
  }

  try {
    return await getSharp()(absolutePath, { animated: true, pages: 1 })
      .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer()
  } catch {
    return null
  }
}
