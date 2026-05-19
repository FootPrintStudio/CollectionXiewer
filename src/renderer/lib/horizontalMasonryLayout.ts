import type { MediaItem } from '../../shared/types'
import { GRID_GAP_PX, mediaAspectRatio } from './galleryLayout'

export type HorizontalMasonryRow = {
  items: MediaItem[]
  widths: number[]
  height: number
}

function rowWidthAtHeight(items: MediaItem[], height: number, gap: number): number {
  if (items.length === 0) return 0
  const thumbs = items.reduce((sum, item) => sum + height * mediaAspectRatio(item), 0)
  return thumbs + gap * (items.length - 1)
}

function justifyRow(items: MediaItem[], containerWidth: number, gap: number): HorizontalMasonryRow {
  const gaps = gap * Math.max(0, items.length - 1)
  const aspectSum = items.reduce((sum, item) => sum + mediaAspectRatio(item), 0)
  const height = aspectSum > 0 ? (containerWidth - gaps) / aspectSum : 0
  const widths = items.map((item) => height * mediaAspectRatio(item))
  return { items, widths, height }
}

/**
 * Pack items into justified rows that span `containerWidth`.
 * Row height varies; each thumbnail keeps its aspect ratio.
 */
export function packHorizontalMasonryRows(
  items: MediaItem[],
  containerWidth: number,
  targetRowHeight: number,
  gap = GRID_GAP_PX
): HorizontalMasonryRow[] {
  if (items.length === 0 || containerWidth <= 0) return []

  const rows: HorizontalMasonryRow[] = []
  let row: MediaItem[] = []

  for (const item of items) {
    const trial = [...row, item]
    const overflows =
      row.length > 0 && rowWidthAtHeight(trial, targetRowHeight, gap) > containerWidth

    if (overflows) {
      rows.push(justifyRow(row, containerWidth, gap))
      row = [item]
    } else {
      row = trial
    }
  }

  if (row.length) rows.push(justifyRow(row, containerWidth, gap))

  return rows
}
