const HEIGHT_KEY = 'collectionXiewer.boardGalleryHeight'
const OPEN_KEY = 'collectionXiewer.boardGalleryOpen'

export const BOARD_GALLERY_HEIGHT_DEFAULT = 240
export const BOARD_GALLERY_HEIGHT_MIN = 100
export const BOARD_GALLERY_HEIGHT_MAX = 560

export function loadBoardGalleryOpen(): boolean {
  try {
    const raw = localStorage.getItem(OPEN_KEY)
    if (raw == null) return true
    return raw === '1'
  } catch {
    return true
  }
}

export function saveBoardGalleryOpen(open: boolean): void {
  try {
    localStorage.setItem(OPEN_KEY, open ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function loadBoardGalleryHeight(): number {
  try {
    const raw = localStorage.getItem(HEIGHT_KEY)
    if (raw == null) return BOARD_GALLERY_HEIGHT_DEFAULT
    const n = Number(raw)
    if (!Number.isFinite(n)) return BOARD_GALLERY_HEIGHT_DEFAULT
    return Math.min(BOARD_GALLERY_HEIGHT_MAX, Math.max(BOARD_GALLERY_HEIGHT_MIN, Math.round(n)))
  } catch {
    return BOARD_GALLERY_HEIGHT_DEFAULT
  }
}

export function saveBoardGalleryHeight(height: number): void {
  try {
    localStorage.setItem(HEIGHT_KEY, String(height))
  } catch {
    /* ignore */
  }
}

export function clampBoardGalleryHeight(height: number): number {
  return Math.min(BOARD_GALLERY_HEIGHT_MAX, Math.max(BOARD_GALLERY_HEIGHT_MIN, Math.round(height)))
}
