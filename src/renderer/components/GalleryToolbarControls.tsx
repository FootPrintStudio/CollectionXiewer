import { useAppStore } from '../store/appStore'
import type { GalleryViewMode, MediaSortOrder } from '../../shared/types'
import { MEDIA_SORT_LABELS, MEDIA_SORT_ORDERS } from '../../shared/mediaSort'
import {
  GALLERY_VIEW_LABELS,
  GALLERY_VIEW_MODES,
  GRID_SIZE_MAX,
  GRID_SIZE_MIN
} from '../lib/galleryLayout'

export function GalleryToolbarControls() {
  const mainView = useAppStore((s) => s.mainView)
  const galleryMode = useAppStore((s) => s.galleryMode)
  const setGalleryMode = useAppStore((s) => s.setGalleryMode)
  const gridSize = useAppStore((s) => s.gridSize)
  const setGridSize = useAppStore((s) => s.setGridSize)
  const mediaSortOrder = useAppStore((s) => s.mediaSortOrder)
  const setMediaSortOrder = useAppStore((s) => s.setMediaSortOrder)
  const media = useAppStore((s) => s.media)
  const openSlideshow = useAppStore((s) => s.openSlideshow)

  if (mainView !== 'gallery') return null

  return (
    <>
      <label className="gallery-toolbar__field">
        <span className="gallery-toolbar__field-label">Sort</span>
        <select
          className="toolbar-select gallery-toolbar__select"
          value={mediaSortOrder}
          onChange={(e) => setMediaSortOrder(e.target.value as MediaSortOrder)}
          aria-label="Media sort order"
        >
          {MEDIA_SORT_ORDERS.map((order) => (
            <option key={order} value={order}>
              {MEDIA_SORT_LABELS[order]}
            </option>
          ))}
        </select>
      </label>
      <label className="gallery-toolbar__field">
        <span className="gallery-toolbar__field-label">View</span>
        <select
          className="toolbar-select gallery-toolbar__select"
          value={galleryMode}
          onChange={(e) => setGalleryMode(e.target.value as GalleryViewMode)}
          aria-label="Gallery view"
        >
          {GALLERY_VIEW_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {GALLERY_VIEW_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="gallery-toolbar__slideshow-btn"
        disabled={media.length === 0}
        onClick={openSlideshow}
        title="Fullscreen slideshow of current results"
      >
        Slideshow
      </button>
      <label className="gallery-toolbar__field gallery-toolbar__field--size">
        <span className="gallery-toolbar__field-label">Size</span>
        <input
          type="range"
          className="gallery-toolbar__range"
          min={GRID_SIZE_MIN}
          max={GRID_SIZE_MAX}
          value={gridSize}
          onChange={(e) => setGridSize(Number(e.target.value))}
          aria-label="Thumbnail size"
        />
        <span className="gallery-toolbar__size-value" aria-hidden>
          {gridSize}
        </span>
      </label>
    </>
  )
}
