import { isDecoderImagePath } from '../../shared/rasterExtensions'
import type { MediaItem } from '../../shared/types'
import { jpegBase64ToObjectUrl } from './blobUrl'
import { mediaUrlFromPath } from './fileUrl'

/** Cap decoded preview JPEG size (HEIC/BMP/TGA) to limit memory use. */
export const PREVIEW_DECODE_MAX_DIM = 4096

export function nativePreviewMaxDim(media: MediaItem): number {
  const w = media.width ?? 2048
  const h = media.height ?? 2048
  return Math.min(PREVIEW_DECODE_MAX_DIM, Math.max(w, h, 2048))
}

/** Preview URL for the crop editor — always the full uncropped image. */
export async function resolveCropEditorSrc(media: MediaItem): Promise<string | null> {
  if (media.kind === 'motion' || media.kind === 'video') {
    return mediaUrlFromPath(media.absolute_path)
  }

  const needsDecode = isDecoderImagePath(media.absolute_path)
  if (!needsDecode) {
    return mediaUrlFromPath(media.absolute_path)
  }

  const b64 = await window.collectionXiewer.preview.getFull(media.id, nativePreviewMaxDim(media))
  return b64 ? jpegBase64ToObjectUrl(b64) : null
}

/** Preview URL for full-size viewer — originals when possible, native-res decode otherwise. */
export async function resolvePreviewSrc(media: MediaItem): Promise<string | null> {
  if (media.kind === 'motion' || media.kind === 'video') {
    return mediaUrlFromPath(media.absolute_path)
  }

  const needsDecode = isDecoderImagePath(media.absolute_path)
  if (!needsDecode) {
    return mediaUrlFromPath(media.absolute_path)
  }

  const b64 = await window.collectionXiewer.preview.get(media.id, nativePreviewMaxDim(media))
  return b64 ? jpegBase64ToObjectUrl(b64) : null
}
