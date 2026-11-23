import { useDraggable, useDroppable } from '@dnd-kit/core'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Tag } from '../../shared/types'
import { formatTagLabel } from '../../shared/tagDisplay'
import { tagChipStyle } from '../lib/tagChipStyle'
import { useResolvedTagColor } from '../hooks/useResolvedTagColor'
import { TagChipContent } from './TagChipContent'
import { tagDragId, tagDropId, type TagDragData } from '../dnd/tagDnd'

interface Props {
  tag: Tag
  depth: number
  isCollapsed: boolean
  hasChildren: boolean
  isSelected: boolean
  isAssociated: boolean
  dropPending: boolean
  dropReady: boolean
  onSelect: () => void
  onToggleCollapse: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onRemoveAssociation?: () => void
}

export function TagTreeRow({
  tag,
  depth,
  isCollapsed,
  hasChildren,
  isSelected,
  isAssociated,
  dropPending,
  dropReady,
  onSelect,
  onToggleCollapse,
  onContextMenu,
  onRemoveAssociation
}: Props) {
  const resolvedColor = useResolvedTagColor(tag)
  const dragData: TagDragData = { type: 'tag', tagId: tag.id }

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging
  } = useDraggable({
    id: tagDragId(tag.id),
    data: dragData
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: tagDropId(tag.id),
    data: { type: 'tag-target', tagId: tag.id }
  })

  const setRefs = (el: HTMLDivElement | null) => {
    setDragRef(el)
    setDropRef(el)
  }

  const dropClass = dropReady
    ? ' tag-drop-ready'
    : dropPending
      ? ' tag-drop-pending'
      : isOver
        ? ' tag-drop-hover'
        : ''

  return (
    <div
      ref={setRefs}
      className={`tag-tree-row${isSelected ? ' active' : ''}${isAssociated ? ' tag-tree-row--associated' : ''}${isDragging ? ' tag-dragging' : ''}${dropClass}`}
      style={{ paddingLeft: `${depth * 14 + 4}px` }}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      {...listeners}
      {...attributes}
    >
      <button
        type="button"
        className="tag-tree-toggle"
        aria-label={isCollapsed ? 'Expand' : 'Collapse'}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onToggleCollapse}
        style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>
      <span
        className={`chip tag-tree-chip${isSelected ? ' tag-tree-chip--selected' : ''}${isAssociated ? ' tag-tree-chip--associated' : ''}${isAssociated ? ' chip--removable' : ''}`}
        style={tagChipStyle(resolvedColor)}
      >
        <TagChipContent tag={tag} />
        {isAssociated && onRemoveAssociation ? (
          <button
            type="button"
            className="chip__remove tag-tree-chip__remove"
            aria-label={`Remove association with ${formatTagLabel(tag)}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onRemoveAssociation()
            }}
          >
            ×
          </button>
        ) : null}
      </span>
    </div>
  )
}
