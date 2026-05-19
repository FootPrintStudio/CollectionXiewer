import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CropRect, MediaItem } from '../../../shared/types'
import { useAppStore } from '../../store/appStore'
import { useMediaTagDrop } from '../../dnd/useMediaTagDrop'
import { ZoomablePreviewImage } from '../../components/ZoomablePreviewImage'
import { MarqueeCropEditor } from '../../components/MarqueeCropEditor'
import { VideoPreviewPlayer } from '../../components/VideoPreviewPlayer'

export function MediaPreviewer() {
  const mediaList = useAppStore((s) => s.media)
  const selectedMediaId = useAppStore((s) => s.selectedMediaId)
  const setSelectedMediaId = useAppStore((s) => s.setSelectedMediaId)
  const cropMode = useAppStore((s) => s.cropMode)
  const setCropMode = useAppStore((s) => s.setCropMode)
  const closePreview = useAppStore((s) => s.closePreview)
  const { setNodeRef: setPreviewDropRef, isDropHover } = useMediaTagDrop(selectedMediaId)

  const [media, setMedia] = useState<MediaItem | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [cropRect, setCropRect] = useState<CropRect | null>(null)

  const currentIndex = useMemo(
    () => mediaList.findIndex((m) => m.id === selectedMediaId),
    [mediaList, selectedMediaId]
  )
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < mediaList.length - 1

  const goToRelative = useCallback(
    (delta: number) => {
      if (currentIndex < 0) return
      const next = mediaList[currentIndex + delta]
      if (next) setSelectedMediaId(next.id)
    },
    [currentIndex, mediaList, setSelectedMediaId]
  )

  const load = useCallback(async (id: number) => {
    const m = await window.collectionXiewer.media.get(id)
    setMedia(m)
    if (!m) return
    const b64 = await window.collectionXiewer.preview.get(id, 2000)
    if (b64) setPreviewSrc(`data:image/jpeg;base64,${b64}`)
    else if (m.kind === 'video') setPreviewSrc(m.absolute_path)
    else setPreviewSrc(null)
  }, [])

  useEffect(() => {
    if (selectedMediaId) void load(selectedMediaId)
    else {
      setMedia(null)
      setPreviewSrc(null)
    }
  }, [selectedMediaId, load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (cropMode) {
          setCropMode(false)
          setCropRect(null)
          return
        }
        closePreview()
        return
      }
      if (cropMode) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToRelative(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToRelative(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closePreview, cropMode, goToRelative, setCropMode])

  const saveCrop = async () => {
    if (!media || !cropRect) return
    await window.collectionXiewer.crop.set(media.id, cropRect)
    setCropMode(false)
    setCropRect(null)
    void load(media.id)
  }

  if (!selectedMediaId || !media) {
    return <div className="empty-hint">No media selected</div>
  }

  const isImage = media.kind === 'image' || media.kind === 'motion'
  const positionLabel =
    currentIndex >= 0 ? `${currentIndex + 1} / ${mediaList.length}` : null

  return (
    <div className="previewer-full">
      <div className="previewer-toolbar">
        <button type="button" onClick={closePreview}>
          ← Gallery
        </button>
        <button
          type="button"
          title="Previous (←)"
          aria-label="Previous media"
          disabled={!hasPrev}
          onClick={() => goToRelative(-1)}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <button
          type="button"
          title="Next (→)"
          aria-label="Next media"
          disabled={!hasNext}
          onClick={() => goToRelative(1)}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
        <span style={{ flex: 1, fontSize: '0.85rem' }}>
          {media.relative_path}
          {positionLabel ? (
            <span className="previewer-position"> · {positionLabel}</span>
          ) : null}
        </span>
        {isImage && (
          <button
            type="button"
            className={cropMode ? 'primary' : ''}
            onClick={() => {
              if (cropMode) setCropRect(null)
              setCropMode(!cropMode)
            }}
          >
            Crop
          </button>
        )}
        {cropMode && (
          <>
            <span className="previewer-crop-hint">
              Drag to select · move inside · resize handles
            </span>
            <button
              type="button"
              className="primary"
              disabled={!cropRect}
              onClick={() => void saveCrop()}
            >
              Save crop
            </button>
            <button
              type="button"
              onClick={() => {
                void window.collectionXiewer.crop.clear(media.id)
                setCropMode(false)
                setCropRect(null)
                void load(media.id)
              }}
            >
              Reset
            </button>
          </>
        )}
        <button type="button" onClick={() => void window.collectionXiewer.crop.export(media.id)}>
          Export crop
        </button>
        <button type="button" onClick={() => window.collectionXiewer.fs.reveal(media.id)}>
          Reveal
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            if (confirm('Delete file from disk?')) {
              void window.collectionXiewer.fs.delete(media.id).then(() => {
                closePreview()
                useAppStore.getState().setSelectedMediaId(null)
                void useAppStore.getState().refreshMedia()
              })
            }
          }}
        >
          Delete
        </button>
      </div>
      <div
        ref={setPreviewDropRef}
        className={`previewer-media-full${isDropHover ? ' media-tag-drop-hover' : ''}`}
      >
        {!cropMode && (hasPrev || hasNext) ? (
          <>
            <button
              type="button"
              className="previewer-nav previewer-nav--prev"
              title="Previous (←)"
              aria-label="Previous media"
              disabled={!hasPrev}
              onClick={() => goToRelative(-1)}
            >
              <ChevronLeft size={28} aria-hidden />
            </button>
            <button
              type="button"
              className="previewer-nav previewer-nav--next"
              title="Next (→)"
              aria-label="Next media"
              disabled={!hasNext}
              onClick={() => goToRelative(1)}
            >
              <ChevronRight size={28} aria-hidden />
            </button>
          </>
        ) : null}
        {cropMode && previewSrc && isImage ? (
          <div className="crop-container">
            <MarqueeCropEditor
              src={previewSrc}
              mediaId={media.id}
              onCropChange={setCropRect}
            />
          </div>
        ) : media.kind === 'video' ? (
          <VideoPreviewPlayer
            mediaId={media.id}
            src={`file://${media.absolute_path}`}
            onPosterSaved={() => void useAppStore.getState().refreshMedia()}
          />
        ) : previewSrc && isImage ? (
          <ZoomablePreviewImage src={previewSrc} alt={media.relative_path} />
        ) : previewSrc ? (
          <img src={previewSrc} alt="" />
        ) : (
          <span className="empty-hint">No preview</span>
        )}
      </div>
    </div>
  )
}
