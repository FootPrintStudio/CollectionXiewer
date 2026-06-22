import type { CropRect } from './types'

const MIN_FRAC = 0.02

export function validateCropRect(rect: CropRect, minFrac = MIN_FRAC): CropRect {
  const { x, y, w, h } = rect
  if (![x, y, w, h].every((n) => Number.isFinite(n))) {
    throw new Error('Invalid region coordinates.')
  }
  let cw = Math.max(minFrac, Math.min(1, w))
  let ch = Math.max(minFrac, Math.min(1, h))
  const cx = Math.max(0, Math.min(1 - cw, x))
  const cy = Math.max(0, Math.min(1 - ch, y))
  return { x: cx, y: cy, w: cw, h: ch }
}

export function pixelRect(rect: CropRect, width: number, height: number) {
  return {
    left: Math.round(rect.x * width),
    top: Math.round(rect.y * height),
    width: Math.max(1, Math.round(rect.w * width)),
    height: Math.max(1, Math.round(rect.h * height))
  }
}

/** Map a normalized region from pre-crop image space into cropped image space. */
export function transformRegionAfterCrop(
  region: CropRect,
  crop: CropRect,
  minFrac = MIN_FRAC
): CropRect | null {
  const x1 = Math.max(region.x, crop.x)
  const y1 = Math.max(region.y, crop.y)
  const x2 = Math.min(region.x + region.w, crop.x + crop.w)
  const y2 = Math.min(region.y + region.h, crop.y + crop.h)
  if (x2 <= x1 || y2 <= y1) return null
  return validateCropRect(
    {
      x: (x1 - crop.x) / crop.w,
      y: (y1 - crop.y) / crop.h,
      w: (x2 - x1) / crop.w,
      h: (y2 - y1) / crop.h
    },
    minFrac
  )
}
