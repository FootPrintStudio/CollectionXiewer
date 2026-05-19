import { mediaAspectRatio as motionAwareAspectRatio } from '../../shared/mediaDimensions'
import type { GalleryViewMode, MediaItem } from '../../shared/types'

const STORAGE_GALLERY_MODE = 'collectionXiewer.galleryMode'
const STORAGE_GRID_SIZE = 'collectionXiewer.gridSize'

export const GRID_SIZE_MIN = 200
export const GRID_SIZE_MAX = 400
export const GRID_SIZE_DEFAULT = 300

export const GALLERY_VIEW_MODES: GalleryViewMode[] = ['grid', 'masonry', 'horizontal']

export const GALLERY_VIEW_LABELS: Record<GalleryViewMode, string> = {
  grid: 'Grid',
  masonry: 'Masonry',
  horizontal: 'H-Masonry'
}

function readStoredNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    const n = Number(raw)
    if (!Number.isFinite(n)) return fallback
    return Math.min(max, Math.max(min, Math.round(n)))
  } catch {
    return fallback
  }
}

export function loadGalleryMode(): GalleryViewMode {
  try {
    const raw = localStorage.getItem(STORAGE_GALLERY_MODE)
    if (raw && GALLERY_VIEW_MODES.includes(raw as GalleryViewMode)) {
      return raw as GalleryViewMode
    }
  } catch {
    /* ignore */
  }
  return 'grid'
}

export function loadGridSize(): number {
  return readStoredNumber(STORAGE_GRID_SIZE, GRID_SIZE_DEFAULT, GRID_SIZE_MIN, GRID_SIZE_MAX)
}

export function saveGalleryMode(mode: GalleryViewMode): void {
  try {
    localStorage.setItem(STORAGE_GALLERY_MODE, mode)
  } catch {
    /* ignore */
  }
}

export function saveGridSize(size: number): void {
  try {
    localStorage.setItem(STORAGE_GRID_SIZE, String(size))
  } catch {
    /* ignore */
  }
}

export function clampGridSize(size: number): number {
  return Math.min(GRID_SIZE_MAX, Math.max(GRID_SIZE_MIN, Math.round(size)))
}

export const GRID_GAP_PX = 6

/** How many columns fit at the target cell size; cells use minmax(target, 1fr) to fill width. */
export function computeGridColumnCount(
  containerWidth: number,
  targetCellSize: number,
  gap = GRID_GAP_PX
): number {
  if (containerWidth <= 0) return 1
  return Math.max(1, Math.floor((containerWidth + gap) / (targetCellSize + gap)))
}

export function computeColumnWidth(
  containerWidth: number,
  columnCount: number,
  gap = GRID_GAP_PX
): number {
  if (containerWidth <= 0 || columnCount <= 0) return 0
  if (columnCount <= 1) return containerWidth
  return (containerWidth - gap * (columnCount - 1)) / columnCount
}

export function mediaAspectRatio(item: Pick<MediaItem, 'width' | 'height' | 'kind'>): number {
  return motionAwareAspectRatio(item.width, item.height, item.kind)
}

/** Rounded sizes for thumb IPC/cache; must be >= display pixels × DPR. */
const THUMB_PIXEL_BUCKETS = [128, 192, 256, 384, 512, 768, 1024] as const

export function thumbPixelSizeForDisplay(displayCssPx: number): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
  const target = Math.ceil(Math.max(1, displayCssPx) * dpr)
  for (const bucket of THUMB_PIXEL_BUCKETS) {
    if (bucket >= target) return bucket
  }
  return THUMB_PIXEL_BUCKETS[THUMB_PIXEL_BUCKETS.length - 1]
}
