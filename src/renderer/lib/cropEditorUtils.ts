import type { CropRect } from '../../shared/types'

export interface Size {
  w: number
  h: number
}

export interface ImageDisplayRect {
  x: number
  y: number
  w: number
  h: number
  scale: number
}

export interface PixelRect {
  left: number
  top: number
  width: number
  height: number
}

export type CropHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'

const MIN_FRAC = 0.02

export function computeImageDisplayRect(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number
): ImageDisplayRect | null {
  if (containerW <= 0 || containerH <= 0 || imageW <= 0 || imageH <= 0) return null
  const scale = Math.min(containerW / imageW, containerH / imageH)
  const w = imageW * scale
  const h = imageH * scale
  return {
    x: (containerW - w) / 2,
    y: (containerH - h) / 2,
    w,
    h,
    scale
  }
}

export function cropToPixelRect(rect: CropRect, display: ImageDisplayRect): PixelRect {
  return {
    left: display.x + rect.x * display.w,
    top: display.y + rect.y * display.h,
    width: rect.w * display.w,
    height: rect.h * display.h
  }
}

export function pixelRectToCrop(px: PixelRect, display: ImageDisplayRect): CropRect {
  return clampCropRect({
    x: (px.left - display.x) / display.w,
    y: (px.top - display.y) / display.h,
    w: px.width / display.w,
    h: px.height / display.h
  })
}

export function clampCropRect(rect: CropRect, minFrac = MIN_FRAC): CropRect {
  let { x, y, w, h } = rect
  w = Math.max(minFrac, Math.min(1, w))
  h = Math.max(minFrac, Math.min(1, h))
  x = Math.max(0, Math.min(1 - w, x))
  y = Math.max(0, Math.min(1 - h, y))
  return { x, y, w, h }
}

export function clientToImagePoint(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  display: ImageDisplayRect
): { x: number; y: number } {
  const x = Math.max(display.x, Math.min(display.x + display.w, clientX - containerRect.left))
  const y = Math.max(display.y, Math.min(display.y + display.h, clientY - containerRect.top))
  return { x, y }
}

export function imagePointToNormalized(
  x: number,
  y: number,
  display: ImageDisplayRect
): { x: number; y: number } {
  return {
    x: (x - display.x) / display.w,
    y: (y - display.y) / display.h
  }
}

export function rectFromPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
  display: ImageDisplayRect
): CropRect {
  const n1 = imagePointToNormalized(a.x, a.y, display)
  const n2 = imagePointToNormalized(b.x, b.y, display)
  const x = Math.min(n1.x, n2.x)
  const y = Math.min(n1.y, n2.y)
  const w = Math.abs(n2.x - n1.x)
  const h = Math.abs(n2.y - n1.y)
  return clampCropRect({ x, y, w, h })
}

const HANDLE_HIT = 12

export function hitTestCrop(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  display: ImageDisplayRect,
  selection: CropRect | null
): 'draw' | 'move' | CropHandle {
  if (!selection) return 'draw'

  const px = cropToPixelRect(selection, display)
  const x = clientX - containerRect.left
  const y = clientY - containerRect.top

  const onHandle = (hx: number, hy: number) =>
    Math.abs(x - hx) <= HANDLE_HIT && Math.abs(y - hy) <= HANDLE_HIT

  const left = px.left
  const top = px.top
  const right = px.left + px.width
  const bottom = px.top + px.height
  const midX = (left + right) / 2
  const midY = (top + bottom) / 2

  if (onHandle(left, top)) return 'nw'
  if (onHandle(right, top)) return 'ne'
  if (onHandle(left, bottom)) return 'sw'
  if (onHandle(right, bottom)) return 'se'
  if (onHandle(midX, top)) return 'n'
  if (onHandle(midX, bottom)) return 's'
  if (onHandle(left, midY)) return 'w'
  if (onHandle(right, midY)) return 'e'

  if (x >= left && x <= right && y >= top && y <= bottom) return 'move'
  return 'draw'
}

export function resizeCrop(
  start: CropRect,
  handle: CropHandle,
  currentImagePoint: { x: number; y: number },
  startImagePoint: { x: number; y: number },
  display: ImageDisplayRect
): CropRect {
  const startPx = cropToPixelRect(start, display)
  const dx = currentImagePoint.x - startImagePoint.x
  const dy = currentImagePoint.y - startImagePoint.y

  let { left, top, width, height } = startPx

  if (handle.includes('e')) width += dx
  if (handle.includes('w')) {
    left += dx
    width -= dx
  }
  if (handle.includes('s')) height += dy
  if (handle.includes('n')) {
    top += dy
    height -= dy
  }

  if (width < 8) {
    if (handle.includes('w')) left = startPx.left + startPx.width - 8
    width = 8
  }
  if (height < 8) {
    if (handle.includes('n')) top = startPx.top + startPx.height - 8
    height = 8
  }

  return pixelRectToCrop({ left, top, width, height }, display)
}

export function moveCrop(
  start: CropRect,
  dxNorm: number,
  dyNorm: number
): CropRect {
  return clampCropRect({
    x: start.x + dxNorm,
    y: start.y + dyNorm,
    w: start.w,
    h: start.h
  })
}
