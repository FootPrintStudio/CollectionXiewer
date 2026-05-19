import { useDraggable } from '@dnd-kit/core'
import type { Tag } from '../../shared/types'
import { formatTagLabel } from '../../shared/tagDisplay'
import { tagChipStyle } from '../lib/tagChipStyle'
import { useResolvedTagColor } from '../hooks/useResolvedTagColor'
import { TagChipContent } from './TagChipContent'
import { mediaTagDragId, type MediaTagDragData } from '../dnd/tagDnd'

interface Props {
  mediaId: number
  subjectId: number
  tag: Tag
  onSelect: () => void
  onRemove: () => void
}

export function MediaTagChip({ mediaId, subjectId, tag, onSelect, onRemove }: Props) {
  const resolvedColor = useResolvedTagColor(tag)
  const dragData: MediaTagDragData = {
    type: 'media-tag',
    mediaId,
    tagId: tag.id,
    sourceSubjectId: subjectId
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: mediaTagDragId(mediaId, subjectId, tag.id),
    data: dragData
  })

  return (
    <span
      ref={setNodeRef}
      className={`chip media-tag-chip${isDragging ? ' tag-dragging' : ''}`}
      style={tagChipStyle(resolvedColor)}
      onClick={onSelect}
      {...listeners}
      {...attributes}
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
