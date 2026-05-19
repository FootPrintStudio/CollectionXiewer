/** Raster formats decoded outside Sharp (libvips build has no BMP/TGA input). */
export const EXOTIC_RASTER_EXTS = ['.bmp', '.tga'] as const

/** HEIC/HEIF — Sharp reads metadata but not HEVC pixels on our libvips build. */
export const HEIC_EXTS = ['.heic', '.heif'] as const

export type ExoticRasterExt = (typeof EXOTIC_RASTER_EXTS)[number]

export function isExoticRasterPath(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  return EXOTIC_RASTER_EXTS.some((ext) => lower.endsWith(ext))
}

export function isHeicPath(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  return HEIC_EXTS.some((ext) => lower.endsWith(ext))
}

/** Images that need a non-Sharp decode path for thumbs/preview. */
export function isDecoderImagePath(filePath: string): boolean {
  return isExoticRasterPath(filePath) || isHeicPath(filePath)
}
