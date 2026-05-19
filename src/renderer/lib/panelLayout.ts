const STORAGE_LIBRARY = 'collectionXiewer.libraryPanelWidth'
const STORAGE_DETAILS = 'collectionXiewer.detailsPanelWidth'

export const LIBRARY_PANEL_MIN = 200
export const LIBRARY_PANEL_MAX = 480
export const LIBRARY_PANEL_DEFAULT = 260

export const DETAILS_PANEL_MIN = 260
export const DETAILS_PANEL_MAX = 560
export const DETAILS_PANEL_DEFAULT = 320

function readStored(key: string, fallback: number, min: number, max: number): number {
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

export function loadLibraryPanelWidth(): number {
  return readStored(STORAGE_LIBRARY, LIBRARY_PANEL_DEFAULT, LIBRARY_PANEL_MIN, LIBRARY_PANEL_MAX)
}

export function loadDetailsPanelWidth(): number {
  return readStored(STORAGE_DETAILS, DETAILS_PANEL_DEFAULT, DETAILS_PANEL_MIN, DETAILS_PANEL_MAX)
}

export function saveLibraryPanelWidth(width: number): void {
  try {
    localStorage.setItem(STORAGE_LIBRARY, String(width))
  } catch {
    /* ignore quota / private mode */
  }
}

export function saveDetailsPanelWidth(width: number): void {
  try {
    localStorage.setItem(STORAGE_DETAILS, String(width))
  } catch {
    /* ignore */
  }
}

export function clampLibraryPanelWidth(width: number): number {
  return Math.min(LIBRARY_PANEL_MAX, Math.max(LIBRARY_PANEL_MIN, Math.round(width)))
}

export function clampDetailsPanelWidth(width: number): number {
  return Math.min(DETAILS_PANEL_MAX, Math.max(DETAILS_PANEL_MIN, Math.round(width)))
}

export function applyPanelWidthCss(libraryWidth: number, detailsWidth: number): void {
  document.documentElement.style.setProperty('--library-panel-w', `${libraryWidth}px`)
  document.documentElement.style.setProperty('--tag-panel-w', `${detailsWidth}px`)
}
