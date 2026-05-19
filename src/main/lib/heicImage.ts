import { readFile } from 'node:fs/promises'
import { getSharp } from './lazyNative'
import {
  type DecodedRaster,
  exportDecodedRasterCrop,
  jpegFromDecodedRaster
} from './rasterFormats'
import type { CropRect } from '../../shared/types'

type HeicDecodeFn = (options: { buffer: Buffer }) => Promise<{
  width: number
  height: number
  data: Uint8ClampedArray
}>

let heicDecode: HeicDecodeFn | null = null

function getHeicDecode(): HeicDecodeFn {
  if (!heicDecode) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    heicDecode = require('heic-decode') as HeicDecodeFn
  }
  return heicDecode
}

export async function readHeicDimensions(
  absolutePath: string
): Promise<{ width: number; height: number } | null> {
  try {
    const meta = await getSharp()(absolutePath).metadata()
    if (meta.width && meta.height) {
      return { width: meta.width, height: meta.height }
    }
  } catch {
    /* metadata-only read failed */
  }

  const decoded = await decodeHeicRaster(absolutePath)
  return decoded ? { width: decoded.width, height: decoded.height } : null
}

export async function decodeHeicRaster(absolutePath: string): Promise<DecodedRaster | null> {
  try {
    const buf = await readFile(absolutePath)
    const img = await getHeicDecode()({ buffer: buf })
    if (!img.width || !img.height || !img.data?.length) return null
    return {
      width: img.width,
      height: img.height,
      data: Buffer.from(img.data)
    }
  } catch {
    return null
  }
}

export async function heicToJpeg(
  absolutePath: string,
  maxSize: number,
  crop?: CropRect | null
): Promise<Buffer | null> {
  const decoded = await decodeHeicRaster(absolutePath)
  if (!decoded) return null
  return jpegFromDecodedRaster(decoded, maxSize, crop)
}

export async function exportHeicCrop(
  absolutePath: string,
  rect: CropRect,
  outPath: string
): Promise<void> {
  const decoded = await decodeHeicRaster(absolutePath)
  if (!decoded) throw new Error('Could not decode HEIC file')
  await exportDecodedRasterCrop(decoded, rect, outPath)
}
