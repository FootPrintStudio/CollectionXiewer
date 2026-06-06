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
