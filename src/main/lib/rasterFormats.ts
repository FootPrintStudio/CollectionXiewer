import { open, readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import bmp from 'bmp-js'
import TGA from 'tga'
import { isExoticRasterPath } from '../../shared/rasterExtensions'
import { getSharp } from './lazyNative'
import { pixelRect } from '../../shared/cropRect'
import type { CropRect } from '../../shared/types'

export { isExoticRasterPath }

export interface DecodedRaster {
  width: number
  height: number
  /** RGBA pixel data */
  data: Buffer
}

export function readExoticRasterDimensionsFromBuffer(
  buf: Buffer,
  ext: string
): { width: number; height: number } | null {
  const e = ext.toLowerCase()
  if (e === '.bmp') return bmpDimensionsFromBuffer(buf)
  if (e === '.tga') return tgaDimensionsFromBuffer(buf)
  return null
}

const RASTER_HEAD_BYTES = 64

export async function readExoticRasterDimensions(
  absolutePath: string
): Promise<{ width: number; height: number } | null> {
  const ext = extname(absolutePath).toLowerCase()
  if (!isExoticRasterPath(absolutePath)) return null
  const fh = await open(absolutePath, 'r')
  try {
    const buf = Buffer.alloc(RASTER_HEAD_BYTES)
    const { bytesRead } = await fh.read(buf, 0, RASTER_HEAD_BYTES, 0)
    return readExoticRasterDimensionsFromBuffer(buf.subarray(0, bytesRead), ext)
  } finally {
    await fh.close()
  }
}

function bmpDimensionsFromBuffer(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 26 || buf.toString('ascii', 0, 2) !== 'BM') return null
  const width = buf.readInt32LE(18)
  const height = Math.abs(buf.readInt32LE(22))
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

function tgaDimensionsFromBuffer(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 18) return null
  const width = buf.readUInt16LE(12)
  const height = buf.readUInt16LE(14)
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

/**
 * bmp-js stores pixels as A,B,G,R per byte; Sharp raw input expects RGBA.
 * 24-bit (and other <32-bit) BMPs keep A=0 for opaque pixels — must be 255 or Sharp renders blank.
 */
function bmpJsToRgba(bmpData: Buffer, bitPP: number): Buffer {
  const rgba = Buffer.alloc(bmpData.length)
  const forceOpaque = bitPP < 32
  for (let i = 0; i < bmpData.length; i += 4) {
    rgba[i] = bmpData[i + 3]
    rgba[i + 1] = bmpData[i + 2]
    rgba[i + 2] = bmpData[i + 1]
    rgba[i + 3] = forceOpaque ? 255 : bmpData[i] || 255
  }
  return rgba
}

export async function decodeExoticRaster(absolutePath: string): Promise<DecodedRaster | null> {
  const ext = extname(absolutePath).toLowerCase()
  const buf = await readFile(absolutePath)

  if (ext === '.bmp') {
    try {
      const decoded = bmp.decode(buf)
      if (!decoded.width || !decoded.height || !decoded.data?.length) return null
      const bitPP = decoded.bitPP ?? 24
      return {
        width: decoded.width,
        height: decoded.height,
        data: bmpJsToRgba(decoded.data, bitPP)
      }
    } catch {
      return null
    }
  }

  if (ext === '.tga') {
    try {
      const tga = new TGA(buf)
      if (!tga.width || !tga.height || !tga.pixels?.length) return null
      return {
        width: tga.width,
        height: tga.height,
        data: Buffer.from(tga.pixels)
      }
    } catch {
      return null
    }
  }

  return null
}

export async function jpegFromDecodedRaster(
  decoded: DecodedRaster,
  maxSize: number,
  crop?: CropRect | null
): Promise<Buffer> {
  const sharp = getSharp()
  let pipeline = sharp(decoded.data, {
    raw: { width: decoded.width, height: decoded.height, channels: 4 }
  })

  if (crop) {
    pipeline = pipeline.extract(pixelRect(crop, decoded.width, decoded.height))
  }

  return pipeline
    .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer()
}

export async function exportDecodedRasterCrop(
  decoded: DecodedRaster,
  rect: CropRect,
  outPath: string
): Promise<void> {
  const sharp = getSharp()
  await sharp(decoded.data, {
    raw: { width: decoded.width, height: decoded.height, channels: 4 }
  })
    .extract(pixelRect(rect, decoded.width, decoded.height))
    .toFile(outPath)
}

export async function exoticRasterToJpeg(
  absolutePath: string,
  maxSize: number,
  crop?: CropRect | null
): Promise<Buffer | null> {
  const decoded = await decodeExoticRaster(absolutePath)
  if (!decoded) return null
  return jpegFromDecodedRaster(decoded, maxSize, crop)
}

export async function exportExoticRasterCrop(
  absolutePath: string,
  rect: CropRect,
  outPath: string
): Promise<void> {
  const decoded = await decodeExoticRaster(absolutePath)
  if (!decoded) throw new Error('Could not decode raster file')
  await exportDecodedRasterCrop(decoded, rect, outPath)
}
