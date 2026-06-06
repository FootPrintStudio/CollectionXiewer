import { useEffect, useRef, useState } from 'react'
import type { Subject, Tag } from '../../shared/types'
import { formatTagLabel } from '../../shared/tagDisplay'
import { useSubjectTagDrop } from '../dnd/useSubjectTagDrop'
import { MediaTagChip } from './MediaTagChip'
import { TagChipContent } from './TagChipContent'
import { hasSubjectRegion, isUniversalSubjectLabel } from '../../shared/subjects'
import { tagChipStyle } from '../lib/tagChipStyle'
import { useResolvedTagColor } from '../hooks/useResolvedTagColor'

interface Props {
  mediaId: number
  subject: Subject
  tags: Tag[]
  croppableMedia?: boolean
  onSelectTag: (tagId: number) => void
  onRemoveTag: (tagId: number, subjectId: number) => void
  onRemoveSubject?: (subjectId: number) => void
  onApplyTag: (tagId: number, subjectId: number) => void
  onSearchTags: (query: string) => Promise<Tag[]>
  onRenameSubject?: (subjectId: number, label: string) => Promise<void>
  onEditRegion?: (subjectId: number, label: string) => void
  onClearRegion?: (subjectId: number) => void
  softSuggestions?: Tag[]
}

function SoftSuggestionChip({ tag, onApply }: { tag: Tag; onApply: () => void }) {
  const color = useResolvedTagColor(tag)
  return (
    <button
      type="button"
      className="chip soft subject-card__soft-chip"
      style={tagChipStyle(color)}
      onClick={onApply}
    >
      <TagChipContent tag={tag} />
    </button>
  )
}

export function SubjectSection({
  mediaId,
  subject,
  tags,
  croppableMedia = false,
  onSelectTag,
  onRemoveTag,
  onRemoveSubject,
  onApplyTag,
  onSearchTags,
  onRenameSubject,
  onEditRegion,
  onClearRegion,
  softSuggestions = []
}: Props) {
  const isUniversal = isUniversalSubjectLabel(subject.label)
  const hasRegion = hasSubjectRegion(subject)
  const { setNodeRef, isDropHover } = useSubjectTagDrop(mediaId, subject.id)
  const [tagInput, setTagInput] = useState('')
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(subject.label)
  const [renameError, setRenameError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editingName) setNameDraft(subject.label)
  }, [subject.label, editingName])

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus()
  }, [editingName])

  const onInputChange = async (q: string) => {
    setTagInput(q)
    if (q.length < 1) {
      setSuggestions([])
      return
    }
    const matches = await onSearchTags(q)
    setSuggestions(matches.filter((t) => !tags.some((existing) => existing.id === t.id)))
  }

  const commitRename = async () => {
    const trimmed = nameDraft.trim()
    if (!onRenameSubject || isUniversal) {
      setEditingName(false)
      return
    }
    if (trimmed === subject.label) {
      setEditingName(false)
      setRenameError(null)
      return
    }
    if (!trimmed) {
      setRenameError('Label is required.')
      return
    }
    try {
      await onRenameSubject(subject.id, trimmed)
      setEditingName(false)
      setRenameError(null)
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : 'Could not rename subject.')
    }
  }

  return (
    <section className={`subject-card${isUniversal ? ' subject-card--universal' : ''}`}>
      <div className="subject-card__header">
        <div className="subject-card__title-row">
          {editingName && onRenameSubject ? (
            <input
              ref={nameInputRef}
              className="subject-card__title-input"
              value={nameDraft}
              onChange={(e) => {
                setNameDraft(e.target.value)
                setRenameError(null)
              }}
              onBlur={() => void commitRename()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') {
                  setNameDraft(subject.label)
                  setRenameError(null)
                  setEditingName(false)
                }
              }}
            />
          ) : (
            <h3 className="subject-card__title">
              {isUniversal ? (
                subject.label
              ) : onRenameSubject ? (
                <button
                  type="button"
                  className="subject-card__title-button"
                  onClick={() => setEditingName(true)}
                  title="Click to rename"
                >
                  {subject.label}
                </button>
              ) : (
                subject.label
              )}
              {isUniversal ? <span className="subject-card__badge">default</span> : null}
              {hasRegion ? <span className="subject-card__badge">on image</span> : null}
            </h3>
          )}
        </div>
        <div className="subject-card__header-actions">
          {!isUniversal && croppableMedia && onEditRegion ? (
            <button
              type="button"
              onClick={() => onEditRegion(subject.id, subject.label)}
              title={hasRegion ? 'Edit region on preview' : 'Add region on preview'}
            >
              {hasRegion ? 'Edit region' : 'Add region'}
            </button>
          ) : null}
          {!isUniversal && hasRegion && onClearRegion ? (
            <button type="button" onClick={() => onClearRegion(subject.id)} title="Remove region">
              Clear region
            </button>
          ) : null}
          {!isUniversal && onRemoveSubject ? (
            <button
              type="button"
              className="danger subject-card__remove"
              onClick={() => onRemoveSubject(subject.id)}
              title="Remove this subject and its tags"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      {renameError ? <p className="field-error subject-card__rename-error">{renameError}</p> : null}

      <div
        ref={setNodeRef}
        className={`subject-card__drop${isDropHover ? ' media-tag-drop-hover' : ''}`}
      >
        <div className="subject-card__chips">
          {tags.length === 0 ? (
            <p className="subject-card__empty">
              Drop tags here, drag between subjects, or add below
            </p>
          ) : (
            tags.map((tag) => (
              <MediaTagChip
                key={`${subject.id}-${tag.id}`}
                mediaId={mediaId}
                subjectId={subject.id}
                tag={tag}
                onSelect={() => onSelectTag(tag.id)}
                onRemove={() => onRemoveTag(tag.id, subject.id)}
              />
            ))
          )}
        </div>
      </div>

      {softSuggestions.length > 0 ? (
        <div className="subject-card__soft-suggestions">
          <p className="subject-card__soft-label">Suggested</p>
          <div className="subject-card__soft-chips">
            {softSuggestions.map((t) => (
              <SoftSuggestionChip
                key={t.id}
                tag={t}
                onApply={() => void onApplyTag(t.id, subject.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <input
        className="subject-card__input"
        placeholder="Add tag to this subject…"
        value={tagInput}
        onChange={(e) => void onInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && suggestions[0]) {
            void onApplyTag(suggestions[0].id, subject.id)
            setTagInput('')
            setSuggestions([])
          }
        }}
      />
      {suggestions.slice(0, 6).map((t) => (
        <button
          key={t.id}
          type="button"
          className="list-item subject-card__suggestion"
          onClick={() => {
            void onApplyTag(t.id, subject.id)
            setTagInput('')
            setSuggestions([])
          }}
        >
          {formatTagLabel(t)}
        </button>
      ))}
    </section>
  )
}
