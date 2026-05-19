import type { BoardItem, BoardMediaItem } from '../../shared/boardSchema'
import { mediaAspectRatio } from '../../shared/mediaDimensions'
import type { MediaKind } from '../../shared/types'

export const BOARD_ITEM_MIN_SIZE = 40

export function worldDeltaToLocal(dx: number, dy: number, rotationDeg: number): { x: number; y: number } {
  const rad = (-rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos
  }
}

export function mediaItemAspect(
  item: BoardMediaItem,
  media?: { width: number | null; height: number | null; kind: MediaKind } | null
): number {
  if (item.aspectRatio && item.aspectRatio > 0) return item.aspectRatio
  if (media) return mediaAspectRatio(media.width, media.height, media.kind)
  return item.width / Math.max(item.height, 1)
}

/** Fit height to width while keeping the visual center fixed. */
export function snapMediaItemToAspect(
  item: BoardMediaItem,
  aspect: number
): Pick<BoardMediaItem, 'width' | 'height' | 'y' | 'aspectRatio'> {
  const safeAspect = aspect > 0 ? aspect : 1
  const height = Math.max(BOARD_ITEM_MIN_SIZE, item.width / safeAspect)
  const cy = item.y + item.height / 2
  return {
    aspectRatio: safeAspect,
    width: item.width,
    height,
    y: cy - height / 2
  }
}

/** Match anchor width; scale height by aspect, keep center fixed. */
export function normalizeMediaToWidth(
  item: BoardMediaItem,
  targetWidth: number
): Pick<BoardMediaItem, 'x' | 'y' | 'width' | 'height' | 'aspectRatio'> {
  const aspect = mediaItemAspect(item)
  const width = Math.max(BOARD_ITEM_MIN_SIZE, targetWidth)
  const height = Math.max(BOARD_ITEM_MIN_SIZE, width / aspect)
  const cx = item.x + item.width / 2
  const cy = item.y + item.height / 2
  return {
    aspectRatio: aspect,
    width,
    height,
    x: cx - width / 2,
    y: cy - height / 2
  }
}

/** Match anchor height; scale width by aspect, keep center fixed. */
export function normalizeMediaToHeight(
  item: BoardMediaItem,
  targetHeight: number
): Pick<BoardMediaItem, 'x' | 'y' | 'width' | 'height' | 'aspectRatio'> {
  const aspect = mediaItemAspect(item)
  const height = Math.max(BOARD_ITEM_MIN_SIZE, targetHeight)
  const width = Math.max(BOARD_ITEM_MIN_SIZE, height * aspect)
  const cx = item.x + item.width / 2
  const cy = item.y + item.height / 2
  return {
    aspectRatio: aspect,
    width,
    height,
    x: cx - width / 2,
    y: cy - height / 2
  }
}

export function resizeBoardItem(
  orig: BoardItem,
  handle: string,
  localDx: number,
  localDy: number,
  lockAspect: number | null
): Pick<BoardItem, 'x' | 'y' | 'width' | 'height'> {
  let x = orig.x
  let y = orig.y
  let width = orig.width
  let height = orig.height
  const min = BOARD_ITEM_MIN_SIZE

  const isCorner = handle.length === 2

  if (lockAspect != null && lockAspect > 0) {
    if (handle === 'e') {
      width = Math.max(min, orig.width + localDx)
      height = width / lockAspect
    } else if (handle === 'w') {
      width = Math.max(min, orig.width - localDx)
      x = orig.x + orig.width - width
      height = width / lockAspect
    } else if (handle === 's') {
      height = Math.max(min, orig.height + localDy)
      width = height * lockAspect
    } else if (handle === 'n') {
      height = Math.max(min, orig.height - localDy)
      y = orig.y + orig.height - height
      width = height * lockAspect
    } else if (isCorner) {
      if (handle.includes('e')) {
        width = Math.max(min, orig.width + localDx)
      } else if (handle.includes('w')) {
        width = Math.max(min, orig.width - localDx)
        x = orig.x + orig.width - width
      }
      height = width / lockAspect
      if (handle.includes('n')) {
        y = orig.y + orig.height - height
      }
    }
    return { x, y, width, height }
  }

  if (handle.includes('e')) width = Math.max(min, orig.width + localDx)
  if (handle.includes('w')) {
    width = Math.max(min, orig.width - localDx)
    x = orig.x + orig.width - width
  }
  if (handle.includes('s')) height = Math.max(min, orig.height + localDy)
  if (handle.includes('n')) {
    height = Math.max(min, orig.height - localDy)
    y = orig.y + orig.height - height
  }

  return { x, y, width, height }
}

export function rotationFromPointer(
  item: BoardItem,
  clientX: number,
  clientY: number,
  viewportRect: DOMRect,
  camera: { x: number; y: number; scale: number },
  startAngle: number,
  startRot: number
): number {
  const cx = item.x + item.width / 2
  const cy = item.y + item.height / 2
  const centerX = cx * camera.scale + camera.x + viewportRect.left
  const centerY = cy * camera.scale + camera.y + viewportRect.top
  const angle = Math.atan2(clientY - centerY, clientX - centerX)
  return ((angle - startAngle) * 180) / Math.PI + startRot
}
