import { useState } from 'react'
import type { Tag } from '../../shared/types'
import { formatTagLabel } from '../../shared/tagDisplay'
import { tagChipStyle } from '../lib/tagChipStyle'
import { useResolvedTagColor } from '../hooks/useResolvedTagColor'
import { TagChipContent } from './TagChipContent'
import { useCollectionPrincipalTagDrop } from '../dnd/useCollectionPrincipalTagDrop'
import {
  addPrincipalTagToCollection,
  removePrincipalTagFromCollection
} from '../lib/collectionPrincipalTags'
import { SectionHelp } from '../ui/SectionHelp'

interface Props {
  collectionId: number
  tags: Tag[]
  onSelectTag: (tagId: number) => void
  onChanged: () => void
  onSearchTags: (query: string) => Promise<Tag[]>
}

function PrincipalTagChip({
  tag,
  onSelect,
  onRemove
}: {
  tag: Tag
  onSelect: () => void
  onRemove: () => void
}) {
  const color = useResolvedTagColor(tag)
  return (
    <span
      className="chip media-tag-chip"
      style={tagChipStyle(color)}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <TagChipContent tag={tag} className="media-tag-chip__content" />
      <button
        type="button"
        className="media-tag-chip__remove"
        aria-label={`Remove ${formatTagLabel(tag)}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
      >
        ×
      </button>
    </span>
  )
}

export function CollectionPrincipalTagsSection({
  collectionId,
  tags,
  onSelectTag,
  onChanged,
  onSearchTags
}: Props) {
  const { setNodeRef, isDropHover } = useCollectionPrincipalTagDrop(collectionId)
  const [tagInput, setTagInput] = useState('')
  const [suggestions, setSuggestions] = useState<Tag[]>([])

  const applyTag = async (tagId: number) => {
    await addPrincipalTagToCollection(collectionId, tagId)
    onChanged()
  }

  const removeTag = async (tagId: number) => {
    await removePrincipalTagFromCollection(collectionId, tagId)
    onChanged()
  }

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
    <section className="collection-principal-tags subject-card" aria-label="Principal tags">
      <p className="panel-title">
        Principal tags
        <SectionHelp label="Principal tags help">
          Tags that characterize this collection. Drag tags from the Tags Library here, or add
          below. Used in search filters (<code>principal:</code>).
        </SectionHelp>
      </p>

      <div
        ref={setNodeRef}
        className={`subject-card__drop collection-principal-tags__drop${isDropHover ? ' media-tag-drop-hover' : ''}`}
      >
        <div className="subject-card__chips">
          {tags.length === 0 ? (
            <p className="subject-card__empty">Drop tags here or add below</p>
          ) : (
            tags.map((tag) => (
              <PrincipalTagChip
                key={tag.id}
                tag={tag}
                onSelect={() => onSelectTag(tag.id)}
                onRemove={() => void removeTag(tag.id)}
              />
            ))
          )}
        </div>
      </div>

      <input
        className="subject-card__input"
        placeholder="Add principal tag…"
        value={tagInput}
        onChange={(e) => void onInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && suggestions[0]) {
            void applyTag(suggestions[0].id).then(() => {
              setTagInput('')
              setSuggestions([])
            })
          }
        }}
      />
      {suggestions.slice(0, 6).map((t) => (
        <button
          key={t.id}
          type="button"
          className="list-item subject-card__suggestion"
          onClick={() => {
            void applyTag(t.id).then(() => {
              setTagInput('')
              setSuggestions([])
            })
          }}
        >
          {formatTagLabel(t)}
        </button>
      ))}
    </section>
  )
}
