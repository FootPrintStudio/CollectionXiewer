import { useRef, useState, type CSSProperties } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { TagLibrarySection, TagTreeNode } from '../../shared/tagTree'
import { TAG_DROP_UNCATEGORIZED, tagGroupDropId, tagDropId } from '../dnd/tagDnd'
import { TagTreeRow } from './TagTreeRow'
import { formatTagLabel } from '../../shared/tagDisplay'
import { DEFAULT_TAG_GROUP_COLOR } from '../../shared/tagColor'
import { TagGlyph } from './TagGlyph'
import { TagGroupAppearanceModal } from '../ui/TagGroupAppearanceModal'

interface TagGroupSectionProps {
  section: TagLibrarySection
  selectedTagId: number | null
  collapsed: Set<number>
  dropPending: (id: string) => boolean
  dropReady: (id: string) => boolean
  onSelect: (tagId: number) => void
  onToggleCollapse: (id: number, e: React.MouseEvent) => void
  onContextMenu: (
    e: React.MouseEvent,
    parentId: number | null,
    parentLabel?: string,
    tagGroupId?: number | null
  ) => void
  onTagGroupContextMenu?: (e: React.MouseEvent, tagGroupId: number, label: string) => void
  onRenameTagGroup?: (tagGroupId: number, label: string) => void
  onTagGroupAppearanceChange?: (
    tagGroupId: number,
    patch: { color: string; icon: string | null }
  ) => void
}

export function TagGroupSection({
  section,
  selectedTagId,
  collapsed,
  dropPending,
  dropReady,
  onSelect,
  onToggleCollapse,
  onContextMenu,
  onTagGroupContextMenu,
  onRenameTagGroup,
  onTagGroupAppearanceChange
}: TagGroupSectionProps) {
  const tagGroup = section.tagGroup
  const dropId = tagGroup != null ? tagGroupDropId(tagGroup.id) : TAG_DROP_UNCATEGORIZED
  const { setNodeRef } = useDroppable({
    id: dropId,
    data: { type: 'tagGroup', tagGroupId: tagGroup?.id ?? null }
  })
  const dropClass = dropReady(dropId) ? ' tag-drop-ready' : dropPending(dropId) ? ' tag-drop-pending' : ''

  const isUncategorized = tagGroup == null
  const groupColor = tagGroup?.color ?? DEFAULT_TAG_GROUP_COLOR
  const groupIcon = tagGroup?.icon ?? null

  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(tagGroup?.label ?? '')
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const labelInputRef = useRef<HTMLInputElement>(null)

  const startRename = () => {
    if (!tagGroup) return
    setLabelDraft(tagGroup.label)
    setEditingLabel(true)
    requestAnimationFrame(() => labelInputRef.current?.select())
  }

  const commitRename = () => {
    if (!tagGroup || !onRenameTagGroup) {
      setEditingLabel(false)
      return
    }
    const trimmed = labelDraft.trim()
    if (trimmed && trimmed !== tagGroup.label) {
      onRenameTagGroup(tagGroup.id, trimmed)
    }
    setEditingLabel(false)
  }

  const renderNode = (node: TagTreeNode, depth: number) => {
    const { tag, children } = node
    const hasChildren = children.length > 0
    const isCollapsed = collapsed.has(tag.id)
    const isSelected = selectedTagId === tag.id
    const dropTargetId = tagDropId(tag.id)

    return (
      <div key={tag.id} className="tag-tree-node">
        <TagTreeRow
          tag={tag}
          depth={depth}
          isCollapsed={isCollapsed}
          hasChildren={hasChildren}
          isSelected={isSelected}
          dropPending={dropPending(dropTargetId)}
          dropReady={dropReady(dropTargetId)}
          onSelect={() => onSelect(tag.id)}
          onToggleCollapse={(e) => hasChildren && onToggleCollapse(tag.id, e)}
          onContextMenu={(e) =>
            onContextMenu(e, tag.id, formatTagLabel(tag), tagGroup?.id ?? null)
          }
        />
        {hasChildren && !isCollapsed && (
          <div className="tag-tree-children">
            {children.map((c) => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const cardStyle =
    !isUncategorized
      ? ({ '--tag-group-color': groupColor } as CSSProperties)
      : undefined

  const iconBtnStyle: CSSProperties = { color: groupColor }

  return (
    <section
      className={`tag-group-card${isUncategorized ? ' tag-group-card--uncategorized' : ' tag-group-card--colored'}`}
      style={cardStyle}
    >
      <header
        className="tag-group-card__header"
        onContextMenu={
          tagGroup && onTagGroupContextMenu
            ? (e) => onTagGroupContextMenu(e, tagGroup.id, tagGroup.label)
            : undefined
        }
      >
        {tagGroup && !isUncategorized ? (
          <button
            type="button"
            className="tag-group-card__icon-btn"
            style={iconBtnStyle}
            title="Edit icon and colour"
            aria-label="Edit tag group icon and colour"
            onClick={(e) => {
              e.stopPropagation()
              setAppearanceOpen(true)
            }}
          >
            {groupIcon ? (
              <TagGlyph icon={groupIcon} color={groupColor} />
            ) : (
              <span className="tag-group-card__icon-placeholder">◇</span>
            )}
          </button>
        ) : null}

        {editingLabel && tagGroup ? (
          <input
            ref={labelInputRef}
            className="tag-group-card__title-input"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setEditingLabel(false)
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        ) : (
          <h3
            className="tag-group-card__title"
            onDoubleClick={(e) => {
              e.stopPropagation()
              if (tagGroup) startRename()
            }}
            title={tagGroup ? 'Double-click to rename' : undefined}
          >
            {tagGroup?.label ?? 'Uncategorized'}
          </h3>
        )}

        {isUncategorized ? <span className="tag-group-card__badge">No group</span> : null}
      </header>
      <div
        ref={setNodeRef}
        className={`tag-group-card__body tag-tree-body${dropClass}`}
        onContextMenu={(e) => onContextMenu(e, null, undefined, tagGroup?.id ?? null)}
      >
        {section.roots.length === 0 ? (
          <p className="tag-group-card__empty">
            {isUncategorized
              ? 'Root tags without a tag group. Drop tags here or create one.'
              : 'Drop tags here or right-click to add a root tag.'}
          </p>
        ) : (
          <div className="tag-tree-list">{section.roots.map((n) => renderNode(n, 0))}</div>
        )}
      </div>

      {appearanceOpen && tagGroup && onTagGroupAppearanceChange ? (
        <TagGroupAppearanceModal
          groupLabel={tagGroup.label}
          color={groupColor}
          icon={groupIcon}
          onClose={() => setAppearanceOpen(false)}
          onSave={(color, icon) => onTagGroupAppearanceChange(tagGroup.id, { color, icon })}
        />
      ) : null}
    </section>
  )
}
