import { isDecoderImagePath } from '../../shared/rasterExtensions'
import type { MediaItem } from '../../shared/types'
import { mediaUrlFromPath } from './fileUrl'

/** Cap decoded preview JPEG size (HEIC/BMP/TGA) to limit memory use. */
export const PREVIEW_DECODE_MAX_DIM = 8192

export function nativePreviewMaxDim(media: MediaItem): number {
  const w = media.width ?? 4096
  const h = media.height ?? 4096
  return Math.min(PREVIEW_DECODE_MAX_DIM, Math.max(w, h, 4096))
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
  return b64 ? `data:image/jpeg;base64,${b64}` : null
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
  return b64 ? `data:image/jpeg;base64,${b64}` : null
}
