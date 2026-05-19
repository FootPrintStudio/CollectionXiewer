import type { MediaKind } from './types'

/** Correct stacked-frame dimensions stored for some animated files. */
export function displayDimensions(
  width: number | null,
  height: number | null,
  kind?: MediaKind
): { width: number | null; height: number | null } {
  if (!width || !height || height <= 0) return { width, height }
  let w = width
  let h = height
  if (kind === 'motion' && h > w * 2) {
    const pages = Math.max(1, Math.round(h / w))
    h = Math.round(h / pages)
  }
  return { width: w, height: h }
}

export function mediaAspectRatio(
  width: number | null,
  height: number | null,
  kind?: MediaKind
): number {
  const d = displayDimensions(width, height, kind)
  if (d.width && d.height && d.height > 0) return d.width / d.height
  return 1
}

export function mediaAspectRatioCss(
  width: number | null,
  height: number | null,
  kind?: MediaKind
): string {
  const d = displayDimensions(width, height, kind)
  if (d.width && d.height) return `${d.width}/${d.height}`
  return '1'
}
