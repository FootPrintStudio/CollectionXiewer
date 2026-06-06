/** Displayed image bounds relative to the zoom viewport (no CSS transform on ancestors). */
export interface PreviewImageGeometry {
  imageRect: { x: number; y: number; w: number; h: number }
}

export function computePreviewImageGeometry(
  viewportW: number,
  viewportH: number,
  contentW: number,
  contentH: number,
  totalScale: number,
  panX: number,
  panY: number
): PreviewImageGeometry | null {
  if (viewportW <= 0 || viewportH <= 0 || contentW <= 0 || contentH <= 0) return null
  const w = contentW * totalScale
  const h = contentH * totalScale
  return {
    imageRect: {
      x: viewportW / 2 + panX - w / 2,
      y: viewportH / 2 + panY - h / 2,
      w,
      h
    }
  }
}
