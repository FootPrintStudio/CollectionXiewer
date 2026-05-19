import type { CropRect } from './types'

export function pixelRect(rect: CropRect, width: number, height: number) {
  return {
    left: Math.round(rect.x * width),
    top: Math.round(rect.y * height),
    width: Math.max(1, Math.round(rect.w * width)),
    height: Math.max(1, Math.round(rect.h * height))
  }
}
