import type { MediaItem } from '../../shared/types'

/** Static raster images only — excludes motion (GIF/WebP) and video. */
export function slideshowEligibleMedia(media: MediaItem[]): MediaItem[] {
  return media.filter((m) => m.kind === 'image')
}
