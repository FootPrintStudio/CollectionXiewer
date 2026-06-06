import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CropRect, MediaItem, Subject } from '../../../shared/types'
import { subjectRegion } from '../../../shared/subjects'
import { useAppStore } from '../../store/appStore'
import { useMediaTagDrop } from '../../dnd/useMediaTagDrop'
import { useTagDnd } from '../../dnd/TagDndContext'
import { ZoomablePreviewImage } from '../../components/ZoomablePreviewImage'
import { SubjectRegionOverlay } from '../../components/SubjectRegionOverlay'
import { SubjectRegionEditor } from '../../components/SubjectRegionEditor'
import { resolvePreviewSrc } from '../../lib/previewSource'
import { mediaUrlFromPath } from '../../lib/fileUrl'
import { MarqueeCropEditor } from '../../components/MarqueeCropEditor'
import { VideoPreviewPlayer } from '../../components/VideoPreviewPlayer'
import { isEditableTarget } from '../../lib/keyboardTargets'
import { showError } from '../../store/toastStore'

export function MediaPreviewer() {
  const mediaList = useAppStore((s) => s.media)
  const selectedMediaId = useAppStore((s) => s.selectedMediaId)
  const setSelectedMediaId = useAppStore((s) => s.setSelectedMediaId)
  const cropMode = useAppStore((s) => s.cropMode)
  const setCropMode = useAppStore((s) => s.setCropMode)
  const showSubjectRegions = useAppStore((s) => s.showSubjectRegions)
  const setShowSubjectRegions = useAppStore((s) => s.setShowSubjectRegions)
  const subjectRegionEdit = useAppStore((s) => s.subjectRegionEdit)
  const setSubjectRegionEdit = useAppStore((s) => s.setSubjectRegionEdit)
  const subjectsRevision = useAppStore((s) => s.subjectsRevision)
  const bumpSubjectsRevision = useAppStore((s) => s.bumpSubjectsRevision)
  const closePreview = useAppStore((s) => s.closePreview)
  const { draggingTag, draggingMediaTag } = useTagDnd()
  const { setNodeRef: setPreviewDropRef, isDropHover } = useMediaTagDrop(selectedMediaId)

  const [media, setMedia] = useState<MediaItem | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [cropRect, setCropRect] = useState<CropRect | null>(null)
  const [hasCrop, setHasCrop] = useState(false)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [regionEditRect, setRegionEditRect] = useState<CropRect | null>(null)

  const currentIndex = useMemo(
    () => mediaList.findIndex((m) => m.id === selectedMediaId),
    [mediaList, selectedMediaId]
  )
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < mediaList.length - 1
  const isRegionEditing =
    subjectRegionEdit != null && subjectRegionEdit.mediaId === selectedMediaId
  const forceVisibleRegions = draggingTag != null || draggingMediaTag != null

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
    if (!m) {
      setHasCrop(false)
      setSubjects([])
      return
    }
    const savedCrop = await window.collectionXiewer.crop.get(id)
    setHasCrop(!!savedCrop)
    const src = await resolvePreviewSrc(m, !!savedCrop)
    setPreviewSrc(src)
    await window.collectionXiewer.subjects.ensure(id)
    setSubjects((await window.collectionXiewer.subjects.list(id)) as Subject[])
  }, [])

  useEffect(() => {
    if (selectedMediaId) void load(selectedMediaId)
    else {
      setMedia(null)
      setPreviewSrc(null)
      setSubjects([])
    }
  }, [selectedMediaId, load])

  useEffect(() => {
    if (!selectedMediaId) return
    void window.collectionXiewer.subjects.ensure(selectedMediaId).then(async () => {
      setSubjects((await window.collectionXiewer.subjects.list(selectedMediaId)) as Subject[])
    })
  }, [selectedMediaId, subjectsRevision])

  useEffect(() => {
    if (!isRegionEditing) {
      setRegionEditRect(null)
      return
    }
    const subject = subjects.find((s) => s.id === subjectRegionEdit!.subjectId)
    setRegionEditRect(subject ? subjectRegion(subject) : null)
  }, [isRegionEditing, subjectRegionEdit, subjects])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      if (e.key === 'Escape') {
        if (cropMode) {
          setCropMode(false)
          setCropRect(null)
          return
        }
        if (isRegionEditing) {
          setSubjectRegionEdit(null)
          setRegionEditRect(null)
          return
        }
        closePreview()
        return
      }
      if (cropMode || isRegionEditing) return
      if (media?.kind === 'video') {
        const videoKeys = [' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'f', 'F', 'm', 'M', 'k', 'K']
        if (videoKeys.includes(e.key)) return
      }
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
  }, [
    closePreview,
    cropMode,
    goToRelative,
    isRegionEditing,
    setCropMode,
    setSubjectRegionEdit,
    media?.kind
  ])

  const saveCrop = async () => {
    if (!media || !cropRect) return
    await window.collectionXiewer.crop.set(media.id, cropRect)
    setCropMode(false)
    setCropRect(null)
    setHasCrop(true)
    void load(media.id)
  }

  const saveSubjectRegion = async () => {
    if (!subjectRegionEdit || !regionEditRect) return
    try {
      await window.collectionXiewer.subjects.update(subjectRegionEdit.subjectId, {
        region: regionEditRect
      })
      setSubjectRegionEdit(null)
      setRegionEditRect(null)
      bumpSubjectsRevision()
    } catch (e) {
      showError(e)
    }
  }

  const clearSubjectRegion = async () => {
    if (!subjectRegionEdit) return
    try {
      await window.collectionXiewer.subjects.clearRegion(subjectRegionEdit.subjectId)
      setSubjectRegionEdit(null)
      setRegionEditRect(null)
      bumpSubjectsRevision()
    } catch (e) {
      showError(e)
    }
  }

  if (!selectedMediaId || !media) {
    return <div className="empty-hint">No media selected</div>
  }

  const isCroppable = media.kind === 'image' || media.kind === 'motion'
  const positionLabel =
    currentIndex >= 0 ? `${currentIndex + 1} / ${mediaList.length}` : null
  const editingSubject = isRegionEditing
    ? subjects.find((s) => s.id === subjectRegionEdit!.subjectId)
    : null

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
        {isCroppable && !isRegionEditing && (
          <button
            type="button"
            className={cropMode ? 'primary' : ''}
            disabled={isRegionEditing}
            onClick={() => {
              if (cropMode) setCropRect(null)
              setCropMode(!cropMode)
            }}
          >
            Crop
          </button>
        )}
        {isCroppable && !cropMode && (
          <button
            type="button"
            className={showSubjectRegions ? 'primary' : ''}
            disabled={isRegionEditing}
            onClick={() => setShowSubjectRegions(!showSubjectRegions)}
            title="Show subject regions on image"
          >
            Regions
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
        {isRegionEditing && subjectRegionEdit && (
          <>
            <span className="previewer-crop-hint">
              Editing region for “{subjectRegionEdit.label}”
            </span>
            <button
              type="button"
              className="primary"
              disabled={!regionEditRect}
              onClick={() => void saveSubjectRegion()}
            >
              Save region
            </button>
            <button type="button" onClick={() => void clearSubjectRegion()}>
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                setSubjectRegionEdit(null)
                setRegionEditRect(null)
              }}
            >
              Cancel
            </button>
          </>
        )}
        {hasCrop ? (
          <button type="button" onClick={() => void window.collectionXiewer.crop.export(media.id)}>
            Export crop
          </button>
        ) : null}
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
        {!cropMode && !isRegionEditing && (hasPrev || hasNext) ? (
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
        {isRegionEditing && previewSrc && isCroppable && editingSubject ? (
          <div className="crop-container">
            <SubjectRegionEditor
              key={editingSubject.id}
              src={previewSrc}
              subjectLabel={editingSubject.label}
              initialRect={subjectRegion(editingSubject)}
              onRectChange={setRegionEditRect}
            />
          </div>
        ) : cropMode && previewSrc && isCroppable ? (
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
            src={mediaUrlFromPath(media.absolute_path)}
            onPosterSaved={() => void useAppStore.getState().refreshMedia()}
          />
        ) : previewSrc && isCroppable ? (
          <ZoomablePreviewImage
            src={previewSrc}
            alt={media.relative_path}
            overlay={
              <SubjectRegionOverlay
                mediaId={media.id}
                subjects={subjects}
                visible={showSubjectRegions}
                forceVisible={forceVisibleRegions}
                highlightSubjectId={subjectRegionEdit?.subjectId ?? null}
              />
            }
          />
        ) : previewSrc ? (
          <img src={previewSrc} alt="" />
        ) : (
          <span className="empty-hint">No preview</span>
        )}
      </div>
    </div>
  )
}
