import { MEDIA_SCHEME } from '../../shared/mediaProtocol'

/** URL the renderer can load for a local media file (GIF/WebP/video, etc.). */
export function mediaUrlFromPath(absolutePath: string): string {
  return `${MEDIA_SCHEME}://open?${new URLSearchParams({ path: absolutePath }).toString()}`
}

/** @deprecated Use mediaUrlFromPath */
export const fileUrlFromPath = mediaUrlFromPath
