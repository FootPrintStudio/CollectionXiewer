import { join } from 'node:path'
import type { MediaItem, WatchRoot } from '../../shared/types'

export function absolutePath(root: WatchRoot, relativePath: string): string {
  return join(root.path, relativePath)
}

export function enrichMedia(
  row: Omit<MediaItem, 'absolute_path'>,
  rootPath: string
): MediaItem {
  return {
    ...row,
    absolute_path: join(rootPath, row.relative_path)
  }
}

type MediaQueryRow = Omit<MediaItem, 'absolute_path' | 'crop'> & {
  root_path: string
  crop_x?: number | null
  crop_y?: number | null
  crop_w?: number | null
  crop_h?: number | null
}

export function enrichMediaWithCrop(row: MediaQueryRow): MediaItem {
  const { root_path, crop_x, crop_y, crop_w, crop_h, ...mediaRow } = row
  const item = enrichMedia(mediaRow, root_path)
  if (crop_x != null && crop_y != null && crop_w != null && crop_h != null) {
    return { ...item, crop: { x: crop_x, y: crop_y, w: crop_w, h: crop_h } }
  }
  return item
}
