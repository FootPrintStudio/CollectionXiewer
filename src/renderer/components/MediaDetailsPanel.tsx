import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import type { Collection, MediaItem, MediaTagSuggestion, Subject, Tag } from '../../shared/types'
import { WikiEditor } from './WikiEditor'
import { NewSubjectModal } from '../ui/NewSubjectModal'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { SubjectSection } from './SubjectSection'
import { MediaDetailsCollectionsSection } from './MediaDetailsCollectionsSection'
import { SectionHelp } from '../ui/SectionHelp'
import { isUniversalSubjectLabel } from '../../shared/subjects'
import { showError } from '../store/toastStore'
import {
  basenameFromRelativePath,
  dirnameFromRelativePath,
  formatDimensions,
  formatMediaKind,
  formatTimestamp,
  splitFilename
} from '../lib/mediaDisplay'

export function MediaDetailsPanel() {
  const selectedMediaId = useAppStore((s) => s.selectedMediaId)
  const mainView = useAppStore((s) => s.mainView)
  const mediaTagsRevision = useAppStore((s) => s.mediaTagsRevision)
  const subjectsRevision = useAppStore((s) => s.subjectsRevision)
  const selectTag = useAppStore((s) => s.selectTag)
  const bumpSubjectsRevision = useAppStore((s) => s.bumpSubjectsRevision)
  const openPreview = useAppStore((s) => s.openPreview)
  const setSubjectRegionEdit = useAppStore((s) => s.setSubjectRegionEdit)
  const setCropMode = useAppStore((s) => s.setCropMode)
  const setSelectedCollectionId = useAppStore((s) => s.setSelectedCollectionId)
  const setDetailsFocus = useAppStore((s) => s.setDetailsFocus)
  const refreshMedia = useAppStore((s) => s.refreshMedia)
  const bumpMediaTagsRevision = useAppStore((s) => s.bumpMediaTagsRevision)
  const bumpCollectionMembersRevision = useAppStore((s) => s.bumpCollectionMembersRevision)
  const refreshCollections = useAppStore((s) => s.refreshCollections)
  const allCollections = useAppStore((s) => s.collections)
  const collectionMembersRevision = useAppStore((s) => s.collectionMembersRevision)

  const [media, setMedia] = useState<MediaItem | null>(null)
  const [fileNameStem, setFileNameStem] = useState('')
  const [fileNameError, setFileNameError] = useState<string | null>(null)
  const [hasCrop, setHasCrop] = useState(false)
  const [memberCollections, setMemberCollections] = useState<Collection[]>([])
  const [mediaTags, setMediaTags] = useState<Array<{ tag: Tag; subject_id: number | null }>>([])
  const [suggestions, setSuggestions] = useState<MediaTagSuggestion[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [showNewSubject, setShowNewSubject] = useState(false)
  const [newSubjectModalKey, setNewSubjectModalKey] = useState(0)
  const [confirmRemoveSubject, setConfirmRemoveSubject] = useState<{
    id: number
    label: string
  } | null>(null)
  const [confirmDeleteMedia, setConfirmDeleteMedia] = useState(false)

  const load = useCallback(async (id: number) => {
    const m = await window.collectionXiewer.media.get(id)
    if (!m) {
      setMedia(null)
      return
    }
    setMedia(m)
    setFileNameStem(splitFilename(basenameFromRelativePath(m.relative_path)).stem)
    setFileNameError(null)

    const crop = await window.collectionXiewer.crop.get(id)
    setHasCrop(crop != null)
    setMemberCollections(await window.collectionXiewer.collections.forMedia(id))

    const mt = await window.collectionXiewer.mediaTags.list(id)
    setMediaTags(
      mt
        .filter((row: { tag?: Tag }) => row.tag)
        .map((row: { tag: Tag; subject_id: number | null }) => ({
          tag: row.tag,
          subject_id: row.subject_id
        }))
    )
    setSuggestions(await window.collectionXiewer.mediaTags.suggestions(id))
    await window.collectionXiewer.subjects.ensure(id)
    const list = (await window.collectionXiewer.subjects.list(id)) as Subject[]
    setSubjects(
      [...list].sort((a, b) => {
        const aU = isUniversalSubjectLabel(a.label) ? 0 : 1
        const bU = isUniversalSubjectLabel(b.label) ? 0 : 1
        if (aU !== bU) return aU - bU
        return a.sort_order - b.sort_order || a.id - b.id
      })
    )
  }, [])

  useEffect(() => {
    if (selectedMediaId) void load(selectedMediaId)
    else setMedia(null)
  }, [selectedMediaId, mediaTagsRevision, subjectsRevision, collectionMembersRevision, load])

  const savedFileNameStem = useMemo(() => {
    if (!media) return ''
    return splitFilename(basenameFromRelativePath(media.relative_path)).stem
  }, [media])

  const tagsBySubject = useMemo(() => {
    const map = new Map<number, Tag[]>()
    for (const s of subjects) map.set(s.id, [])
    for (const row of mediaTags) {
      if (row.subject_id == null || !row.tag) continue
      const list = map.get(row.subject_id) ?? []
      list.push(row.tag)
      map.set(row.subject_id, list)
    }
    return map
  }, [subjects, mediaTags])

  const suggestionsBySubject = useMemo(() => {
    const map = new Map<number, Tag[]>()
    const seen = new Map<number, Set<number>>()
    for (const row of suggestions) {
      if (!row.tag) continue
      let ids = seen.get(row.subject_id)
      if (!ids) {
        ids = new Set()
        seen.set(row.subject_id, ids)
      }
      if (ids.has(row.tag_id)) continue
      ids.add(row.tag_id)
      const list = map.get(row.subject_id) ?? []
      list.push(row.tag)
      map.set(row.subject_id, list)
    }
    return map
  }, [suggestions])

  if (!selectedMediaId || !media) {
    return <p className="empty-hint">No media selected.</p>
  }

  const isImage = media.kind === 'image' || media.kind === 'motion'
  const folderPath = dirnameFromRelativePath(media.relative_path)
  const fileExt = splitFilename(basenameFromRelativePath(media.relative_path)).ext

  const commitRename = async () => {
    const trimmed = fileNameStem.trim()
    if (!trimmed) {
      setFileNameStem(savedFileNameStem)
      setFileNameError('File name cannot be empty.')
      return
    }
    if (trimmed === savedFileNameStem) {
      setFileNameError(null)
      return
    }
    try {
      await window.collectionXiewer.fs.rename(selectedMediaId, trimmed)
      setFileNameError(null)
      await load(selectedMediaId)
      void refreshMedia()
    } catch (err) {
      setFileNameStem(savedFileNameStem)
      setFileNameError(err instanceof Error ? err.message : 'Could not rename file.')
    }
  }

  const openLargePreview = () => {
    if (mainView !== 'preview') openPreview(selectedMediaId)
  }

  const openCropEditor = () => {
    openPreview(selectedMediaId)
    setCropMode(true)
  }

  const applyTag = async (tagId: number, subjectId: number) => {
    await window.collectionXiewer.mediaTags.apply(selectedMediaId, tagId, subjectId)
    void load(selectedMediaId)
    bumpMediaTagsRevision()
  }

  const removeTag = async (tagId: number, subjectId: number) => {
    await window.collectionXiewer.mediaTags.remove(selectedMediaId, tagId, subjectId)
    void load(selectedMediaId)
    bumpMediaTagsRevision()
  }

  const requestRemoveSubject = (subjectId: number) => {
    const subject = subjects.find((s) => s.id === subjectId)
    if (!subject || isUniversalSubjectLabel(subject.label)) return
    setShowNewSubject(false)
    setConfirmRemoveSubject({ id: subject.id, label: subject.label })
  }

  const removeSubject = async (subjectId: number) => {
    try {
      await window.collectionXiewer.subjects.remove(subjectId)
      setConfirmRemoveSubject(null)
      void load(selectedMediaId)
      bumpMediaTagsRevision()
      bumpSubjectsRevision()
    } catch (e) {
      showError(e)
      setConfirmRemoveSubject(null)
    }
  }

  const deleteMedia = async () => {
    await window.collectionXiewer.fs.delete(selectedMediaId)
    setConfirmDeleteMedia(false)
    useAppStore.getState().setSelectedMediaId(null)
    void refreshMedia()
  }

  const openNewSubjectModal = () => {
    setConfirmRemoveSubject(null)
    setNewSubjectModalKey((k) => k + 1)
    setShowNewSubject(true)
  }

  const renameSubject = async (subjectId: number, label: string) => {
    await window.collectionXiewer.subjects.update(subjectId, { label })
    void load(selectedMediaId)
    bumpSubjectsRevision()
  }

  const editSubjectRegion = (subjectId: number, label: string) => {
    if (mainView !== 'preview') openPreview(selectedMediaId)
    setCropMode(false)
    setSubjectRegionEdit({ mediaId: selectedMediaId, subjectId, label })
  }

  const clearSubjectRegion = async (subjectId: number) => {
    try {
      await window.collectionXiewer.subjects.clearRegion(subjectId)
      void load(selectedMediaId)
      bumpSubjectsRevision()
    } catch (e) {
      showError(e)
    }
  }

  const onSearchTags = (q: string) => window.collectionXiewer.tags.search(q)

  return (
    <div className="media-details-panel">
      <h2 className="media-details-panel__title">Media</h2>

      <section className="media-details-section" aria-label="File">
        <p className="panel-title">File</p>
        <div className="field">
          <label htmlFor="media-file-name">File name</label>
          <div className="media-details-filename">
            <input
              id="media-file-name"
              value={fileNameStem}
              onChange={(e) => {
                setFileNameStem(e.target.value)
                setFileNameError(null)
              }}
              onBlur={() => void commitRename()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') {
                  setFileNameStem(savedFileNameStem)
                  setFileNameError(null)
                  e.currentTarget.blur()
                }
              }}
              spellCheck={false}
            />
            {fileExt ? <span className="media-details-filename__ext">{fileExt}</span> : null}
          </div>
          {fileNameError ? <p className="field-error">{fileNameError}</p> : null}
        </div>
        <p className="media-details-meta">
          <span className="media-details-meta__label">Folder</span>
          <span className="media-details-meta__value">{folderPath}</span>
        </p>
      </section>

      <section className="media-details-section" aria-label="Properties">
        <p className="panel-title">Properties</p>
        <dl className="media-details-dl">
          <div>
            <dt>Type</dt>
            <dd>{formatMediaKind(media.kind)}</dd>
          </div>
          <div>
            <dt>Dimensions</dt>
            <dd>{formatDimensions(media.width, media.height)}</dd>
          </div>
          {media.mime ? (
            <div>
              <dt>MIME</dt>
              <dd>{media.mime}</dd>
            </div>
          ) : null}
          <div>
            <dt>Modified</dt>
            <dd>{formatTimestamp(media.mtime)}</dd>
          </div>
          <div>
            <dt>Indexed</dt>
            <dd>{formatTimestamp(media.indexed_at)}</dd>
          </div>
          <div>
            <dt>Crop</dt>
            <dd>{hasCrop ? 'Custom crop saved' : 'Full image'}</dd>
          </div>
        </dl>
      </section>

      <section className="media-details-section" aria-label="Actions">
        <p className="panel-title">Actions</p>
        <div className="media-details-actions">
          {mainView !== 'preview' ? (
            <button type="button" className="primary" onClick={openLargePreview}>
              Open preview
            </button>
          ) : null}
          {isImage ? (
            <button type="button" onClick={openCropEditor}>
              {hasCrop ? 'Edit crop' : 'Crop'}
            </button>
          ) : null}
          <button type="button" onClick={() => window.collectionXiewer.fs.reveal(media.id)}>
            Reveal in folder
          </button>
          {hasCrop ? (
            <button type="button" onClick={() => void window.collectionXiewer.crop.export(media.id)}>
              Export crop
            </button>
          ) : null}
          <button type="button" className="danger" onClick={() => setConfirmDeleteMedia(true)}>
            Delete file
          </button>
        </div>
      </section>

      <MediaDetailsCollectionsSection
        mediaId={media.id}
        memberCollections={memberCollections}
        allCollections={allCollections}
        onMembersChange={setMemberCollections}
        onOpenCollection={(collectionId) => {
          setSelectedCollectionId(collectionId)
          setDetailsFocus('collection')
        }}
        onMembershipChanged={() => {
          bumpCollectionMembersRevision()
          void refreshCollections()
          void refreshMedia()
        }}
      />

      <section className="subjects-panel">
        <div className="subjects-panel__header">
          <p className="panel-title">
            Subjects
            <SectionHelp label="Subjects help">
              Each subject holds its own tags—the same tag can appear in multiple subjects (e.g. a
              shared trait on different characters). Drag tags between subjects, from the Tags
              Library to add, or onto thumbnails / preview for Universal.
            </SectionHelp>
          </p>
          <button type="button" className="primary" onClick={openNewSubjectModal}>
            + Subject
          </button>
        </div>

        {subjects.map((subject) => (
          <SubjectSection
            key={subject.id}
            mediaId={selectedMediaId}
            subject={subject}
            tags={tagsBySubject.get(subject.id) ?? []}
            croppableMedia={isImage}
            onSelectTag={selectTag}
            onRemoveTag={(tagId, subjectId) => void removeTag(tagId, subjectId)}
            onRemoveSubject={
              isUniversalSubjectLabel(subject.label)
                ? undefined
                : (subjectId) => requestRemoveSubject(subjectId)
            }
            onApplyTag={(tagId, subjectId) => void applyTag(tagId, subjectId)}
            onSearchTags={onSearchTags}
            onRenameSubject={
              isUniversalSubjectLabel(subject.label)
                ? undefined
                : (subjectId, label) => renameSubject(subjectId, label)
            }
            onEditRegion={
              isUniversalSubjectLabel(subject.label) ? undefined : editSubjectRegion
            }
            onClearRegion={
              isUniversalSubjectLabel(subject.label) ? undefined : (id) => void clearSubjectRegion(id)
            }
            softSuggestions={suggestionsBySubject.get(subject.id) ?? []}
          />
        ))}
      </section>

      {confirmRemoveSubject && (
        <ConfirmDialog
          title="Remove subject?"
          message={`Remove “${confirmRemoveSubject.label}” and all tags in this subject?`}
          confirmLabel="Remove"
          danger
          onCancel={() => setConfirmRemoveSubject(null)}
          onConfirm={() => void removeSubject(confirmRemoveSubject.id)}
        />
      )}

      {confirmDeleteMedia && (
        <ConfirmDialog
          title="Delete file?"
          message={`Delete “${basenameFromRelativePath(media.relative_path)}” from disk? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDeleteMedia(false)}
          onConfirm={() => void deleteMedia()}
        />
      )}

      {showNewSubject && (
        <NewSubjectModal
          key={newSubjectModalKey}
          mediaId={selectedMediaId}
          existingLabels={subjects.map((s) => s.label)}
          onClose={() => setShowNewSubject(false)}
          onCreated={() => {
            void load(selectedMediaId)
            bumpMediaTagsRevision()
            bumpSubjectsRevision()
          }}
        />
      )}

      <WikiEditor entityType="media" entityId={selectedMediaId} />
    </div>
  )
}
