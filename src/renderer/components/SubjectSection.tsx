import { useState } from 'react'
import type { Subject, Tag } from '../../shared/types'
import { formatTagLabel } from '../../shared/tagDisplay'
import { useSubjectTagDrop } from '../dnd/useSubjectTagDrop'
import { MediaTagChip } from './MediaTagChip'
import { TagChipContent } from './TagChipContent'
import { isUniversalSubjectLabel } from '../../shared/subjects'
import { tagChipStyle } from '../lib/tagChipStyle'
import { useResolvedTagColor } from '../hooks/useResolvedTagColor'

interface Props {
  mediaId: number
  subject: Subject
  tags: Tag[]
  onSelectTag: (tagId: number) => void
  onRemoveTag: (tagId: number, subjectId: number) => void
  onRemoveSubject?: (subjectId: number) => void
  onApplyTag: (tagId: number, subjectId: number) => void
  onSearchTags: (query: string) => Promise<Tag[]>
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
  onSelectTag,
  onRemoveTag,
  onRemoveSubject,
  onApplyTag,
  onSearchTags,
  softSuggestions = []
}: Props) {
  const isUniversal = isUniversalSubjectLabel(subject.label)
  const { setNodeRef, isDropHover } = useSubjectTagDrop(mediaId, subject.id)
  const [tagInput, setTagInput] = useState('')
  const [suggestions, setSuggestions] = useState<Tag[]>([])

  const onInputChange = async (q: string) => {
    setTagInput(q)
    if (q.length < 1) {
      setSuggestions([])
      return
    }
    const matches = await onSearchTags(q)
    setSuggestions(matches.filter((t) => !tags.some((existing) => existing.id === t.id)))
  }

  return (
    <section className={`subject-card${isUniversal ? ' subject-card--universal' : ''}`}>
      <div className="subject-card__header">
        <h3 className="subject-card__title">
          {subject.label}
          {isUniversal ? <span className="subject-card__badge">default</span> : null}
        </h3>
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
