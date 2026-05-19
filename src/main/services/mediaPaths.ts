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
