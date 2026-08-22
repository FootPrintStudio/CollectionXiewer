import type { MediaItem } from '../../shared/types'
import { mediaAspectRatio } from './galleryLayout'

/** Assign items to the shortest column for balanced masonry. */
export function packMasonryColumns(
  items: MediaItem[],
  columnCount: number,
  columnWidth: number,
  gap: number,
  /** Sticky column assignments from a previous pack (mediaId → column index). */
  stickyColumns?: Map<number, number>
): { columns: MediaItem[][]; assignments: Map<number, number> } {
  const columns: MediaItem[][] = Array.from({ length: columnCount }, () => [])
  const heights = Array<number>(columnCount).fill(0)
  const assignments = new Map<number, number>()

  for (const item of items) {
    let target = stickyColumns?.get(item.id)
    if (target == null || target < 0 || target >= columnCount) {
      target = 0
      for (let i = 1; i < columnCount; i++) {
        if (heights[i]! < heights[target]!) target = i
      }
    }
    columns[target]!.push(item)
    heights[target]! += columnWidth / mediaAspectRatio(item) + gap
    assignments.set(item.id, target)
  }

  return { columns, assignments }
}
