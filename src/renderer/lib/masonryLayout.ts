import type { MediaItem } from '../../shared/types'
import { mediaAspectRatio } from './galleryLayout'

/** Assign items to the shortest column for balanced masonry. */
export function packMasonryColumns(
  items: MediaItem[],
  columnCount: number,
  columnWidth: number,
  gap: number
): MediaItem[][] {
  const columns: MediaItem[][] = Array.from({ length: columnCount }, () => [])
  const heights = Array<number>(columnCount).fill(0)

  for (const item of items) {
    let target = 0
    for (let i = 1; i < columnCount; i++) {
      if (heights[i] < heights[target]) target = i
    }
    columns[target].push(item)
    heights[target] += columnWidth / mediaAspectRatio(item) + gap
  }

  return columns
}
