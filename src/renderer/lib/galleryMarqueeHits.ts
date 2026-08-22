import type { MediaItem } from '../../shared/types'
import { mediaAspectRatio } from './galleryLayout'
import type { HorizontalMasonryRow } from './horizontalMasonryLayout'

export type ContentRect = {
  left: number
  top: number
  right: number
  bottom: number
}

function intersects(
  a: ContentRect,
  b: { left: number; top: number; right: number; bottom: number }
): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

/** Grid: square cells in virtual rows. */
export function hitTestGridLayout(
  marquee: ContentRect,
  rows: MediaItem[][],
  columnCount: number,
  columnWidth: number,
  gap: number
): number[] {
  const hits: number[] = []
  const rowStride = columnWidth + gap
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!
    const top = r * rowStride
    const bottom = top + columnWidth
    if (bottom < marquee.top || top > marquee.bottom) continue
    for (let c = 0; c < row.length; c++) {
      const left = c * (columnWidth + gap)
      const right = left + columnWidth
      if (
        intersects(marquee, { left, top, right, bottom })
      ) {
        hits.push(row[c]!.id)
      }
    }
  }
  void columnCount
  return hits
}

/** Horizontal justified masonry rows. */
export function hitTestHorizontalLayout(
  marquee: ContentRect,
  rows: HorizontalMasonryRow[],
  gap: number
): number[] {
  const hits: number[] = []
  let y = 0
  for (const row of rows) {
    const top = y
    const bottom = y + row.height
    if (bottom >= marquee.top && top <= marquee.bottom) {
      let x = 0
      for (let i = 0; i < row.items.length; i++) {
        const w = row.widths[i]!
        const left = x
        const right = x + w
        if (intersects(marquee, { left, top, right, bottom })) {
          hits.push(row.items[i]!.id)
        }
        x += w + gap
      }
    }
    y += row.height + gap
  }
  return hits
}

/** Vertical masonry columns (absolute / flex stacked). */
export function hitTestMasonryLayout(
  marquee: ContentRect,
  columns: MediaItem[][],
  columnWidth: number,
  gap: number
): number[] {
  const hits: number[] = []
  for (let c = 0; c < columns.length; c++) {
    const left = c * (columnWidth + gap)
    const right = left + columnWidth
    if (right < marquee.left || left > marquee.right) continue
    let y = 0
    for (const item of columns[c]!) {
      const h = columnWidth / mediaAspectRatio(item)
      const top = y
      const bottom = y + h
      if (intersects(marquee, { left, top, right, bottom })) {
        hits.push(item.id)
      }
      y += h + gap
    }
  }
  return hits
}
