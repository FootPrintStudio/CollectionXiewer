import { useMemo, useState, useCallback, useEffect } from 'react'
import { buildTagLibrarySections, getTagSiblings } from '../../shared/tagTree'
import { formatTagLabel } from '../../shared/tagDisplay'
import { useAppStore } from '../store/appStore'
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu'
import { NewTagModal } from '../ui/NewTagModal'
import { NewTagGroupModal } from '../ui/NewTagGroupModal'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { TagGroupSection } from './TagGroupSection'
import type { Tag, TagGroup } from '../../shared/types'
import { TAG_HOLD_MS } from '../dnd/tagDnd'
import { useTagDnd } from '../dnd/TagDndContext'

interface MenuState {
  x: number
  y: number
  parentId: number | null
  parentLabel?: string
  tagGroupId: number | null
}

interface TagGroupMenuState {
  x: number
  y: number
  tagGroupId: number
  label: string
}

interface NewTagRequest {
  parentId: number | null
  parentLabel?: string
  tagGroupId: number | null
}

interface DeleteTagRequest {
  tag: Tag
  mediaCount: number
  childCount: number
}

export function TagTreeView() {
  const tags = useAppStore((s) => s.tags)
  const tagGroups = useAppStore((s) => s.tagGroups)
  const selectedTagId = useAppStore((s) => s.selectedTagId)
  const selectTag = useAppStore((s) => s.selectTag)
  const refreshTags = useAppStore((s) => s.refreshTags)
  const refreshTagGroups = useAppStore((s) => s.refreshTagGroups)
  const refreshMedia = useAppStore((s) => s.refreshMedia)
  const bumpMediaTagsRevision = useAppStore((s) => s.bumpMediaTagsRevision)
  const bumpCollectionDetailsRevision = useAppStore((s) => s.bumpCollectionDetailsRevision)

  const { draggingTag, isPending, isReady, setReparentSideEffects } = useTagDnd()

  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set())
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [tagGroupMenu, setTagGroupMenu] = useState<TagGroupMenuState | null>(null)
  const [newTagRequest, setNewTagRequest] = useState<NewTagRequest | null>(null)
  const [showNewTagGroup, setShowNewTagGroup] = useState(false)
  const [deleteTagGroup, setDeleteTagGroup] = useState<TagGroup | null>(null)
  const [deleteTagRequest, setDeleteTagRequest] = useState<DeleteTagRequest | null>(null)

  const sections = useMemo(
    () => buildTagLibrarySections(tagGroups, tags),
    [tagGroups, tags]
  )

  useEffect(() => {
    setReparentSideEffects((newParent) => {
      if (newParent != null) {
        setCollapsed((prev) => {
          const next = new Set(prev)
          next.delete(newParent)
          return next
        })
      }
    })
    return () => setReparentSideEffects(null)
  }, [setReparentSideEffects])

  const toggleCollapsed = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openNewTagDialog = useCallback(
    (parentId: number | null, tagGroupId: number | null, parentLabel?: string) => {
      setMenu(null)
      setTagGroupMenu(null)
      setNewTagRequest({ parentId, tagGroupId, parentLabel })
    },
    []
  )

  const onTagCreated = useCallback(
    async (tag: Tag) => {
      await refreshTags()
      selectTag(tag.id)
      if (tag.parent_id != null) {
        setCollapsed((prev) => {
          const next = new Set(prev)
          next.delete(tag.parent_id!)
          return next
        })
      }
    },
    [refreshTags, selectTag]
  )

  const openMenu = (
    e: React.MouseEvent,
    parentId: number | null,
    parentLabel?: string,
    tagGroupId: number | null = null
  ) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, parentId, parentLabel, tagGroupId })
  }

  const openTagGroupMenu = (e: React.MouseEvent, tagGroupId: number, label: string) => {
    e.preventDefault()
    e.stopPropagation()
    setTagGroupMenu({ x: e.clientX, y: e.clientY, tagGroupId, label })
  }

  const tagMenuSiblings = menu?.parentId != null ? getTagSiblings(menu.parentId, tags) : []
  const tagMenuIndex =
    menu?.parentId != null ? tagMenuSiblings.findIndex((t) => t.id === menu.parentId) : -1

  const openDeleteTagDialog = useCallback(
    async (tagId: number) => {
      const tag = tags.find((t) => t.id === tagId)
      if (!tag) return
      setMenu(null)
      const impact = await window.collectionXiewer.tags.deleteImpact(tagId)
      setDeleteTagRequest({ tag, mediaCount: impact.mediaCount, childCount: impact.childCount })
    },
    [tags]
  )

  const sortGroupRoots = (tagGroupId: number | null) => {
    void window.collectionXiewer.tags.sortGroupRootsAlphabetically(tagGroupId).then(() => refreshTags())
  }

  const sortTagChildren = (parentTagId: number) => {
    void window.collectionXiewer.tags.sortChildrenAlphabetically(parentTagId).then(() => refreshTags())
  }

  const menuItems: ContextMenuItem[] = menu
    ? menu.parentId == null
      ? [
          {
            label: menu.tagGroupId != null ? 'New root tag in group' : 'New root tag',
            onClick: () => openNewTagDialog(null, menu.tagGroupId)
          },
          {
            label: 'Sort children alphabetically',
            onClick: () => {
              sortGroupRoots(menu.tagGroupId)
              setMenu(null)
            }
          }
        ]
      : [
          {
            label: `New child of ${menu.parentLabel ?? 'tag'}`,
            onClick: () => openNewTagDialog(menu.parentId, menu.tagGroupId, menu.parentLabel)
          },
          {
            label: 'Move up',
            disabled: tagMenuIndex <= 0,
            onClick: () => {
              void window.collectionXiewer.tags
                .move(menu.parentId!, 'up')
                .then(() => refreshTags())
              setMenu(null)
            }
          },
          {
            label: 'Move down',
            disabled: tagMenuIndex < 0 || tagMenuIndex >= tagMenuSiblings.length - 1,
            onClick: () => {
              void window.collectionXiewer.tags
                .move(menu.parentId!, 'down')
                .then(() => refreshTags())
              setMenu(null)
            }
          },
          {
            label: 'Sort children alphabetically',
            onClick: () => {
              sortTagChildren(menu.parentId!)
              setMenu(null)
            }
          },
          {
            label: 'Delete tag',
            danger: true,
            onClick: () => {
              void openDeleteTagDialog(menu.parentId!)
            }
          }
        ]
    : []

  const tagGroupIndex = tagGroupMenu
    ? tagGroups.findIndex((g) => g.id === tagGroupMenu.tagGroupId)
    : -1

  const tagGroupMenuItems: ContextMenuItem[] = tagGroupMenu
    ? [
        {
          label: 'New root tag',
          onClick: () => openNewTagDialog(null, tagGroupMenu.tagGroupId, tagGroupMenu.label)
        },
        {
          label: 'Move up',
          disabled: tagGroupIndex <= 0,
          onClick: () => {
            void window.collectionXiewer.tagGroups
              .move(tagGroupMenu.tagGroupId, 'up')
              .then(() => refreshTagGroups())
          }
        },
        {
          label: 'Move down',
          disabled: tagGroupIndex < 0 || tagGroupIndex >= tagGroups.length - 1,
          onClick: () => {
            void window.collectionXiewer.tagGroups
              .move(tagGroupMenu.tagGroupId, 'down')
              .then(() => refreshTagGroups())
          }
        },
        {
          label: 'Sort children alphabetically',
          onClick: () => {
            sortGroupRoots(tagGroupMenu.tagGroupId)
            setTagGroupMenu(null)
          }
        },
        {
          label: 'Delete tag group',
          danger: true,
          onClick: () => {
            const group = tagGroups.find((g) => g.id === tagGroupMenu.tagGroupId)
            if (group) setDeleteTagGroup(group)
            setTagGroupMenu(null)
          }
        }
      ]
    : []

  const handleRenameTagGroup = useCallback(
    async (tagGroupId: number, label: string) => {
      await window.collectionXiewer.tagGroups.update(tagGroupId, { label })
      await refreshTagGroups()
    },
    [refreshTagGroups]
  )

  const handleTagGroupAppearanceChange = useCallback(
    async (tagGroupId: number, patch: { color: string; icon: string | null }) => {
      await window.collectionXiewer.tagGroups.update(tagGroupId, patch)
      await refreshTagGroups()
    },
    [refreshTagGroups]
  )

  const confirmDeleteTagGroup = async () => {
    if (!deleteTagGroup) return
    await window.collectionXiewer.tagGroups.remove(deleteTagGroup.id)
    await refreshTagGroups()
    await refreshTags()
    setDeleteTagGroup(null)
  }

  const confirmDeleteTag = async () => {
    if (!deleteTagRequest) return
    const deletedId = deleteTagRequest.tag.id
    await window.collectionXiewer.tags.remove(deletedId)
    if (selectedTagId === deletedId) {
      selectTag(null)
    }
    await refreshTags()
    bumpMediaTagsRevision()
    bumpCollectionDetailsRevision()
    await refreshMedia()
    setDeleteTagRequest(null)
  }

  const deleteTagMessage = deleteTagRequest
    ? (() => {
        const label = formatTagLabel(deleteTagRequest.tag)
        const parts = [
          `Delete “${label}”? It will be removed from the tag library and from all media (${deleteTagRequest.mediaCount} item${deleteTagRequest.mediaCount === 1 ? '' : 's'}).`
        ]
        if (deleteTagRequest.childCount > 0) {
          parts.push(
            `${deleteTagRequest.childCount} direct child tag${deleteTagRequest.childCount === 1 ? '' : 's'} will become root-level tags.`
          )
        }
        return parts.join(' ')
      })()
    : ''

  return (
    <div className="tag-tree">
      <div className="tag-tree-toolbar">
        <button
          type="button"
          className="primary tag-tree-new-btn"
          onClick={() => openNewTagDialog(null, null)}
        >
          + New tag
        </button>
        <button type="button" className="tag-tree-new-btn" onClick={() => setShowNewTagGroup(true)}>
          + Tag group
        </button>
      </div>

      <div className="tag-tree-scroll">
        {sections.map((section) => (
          <TagGroupSection
            key={section.tagGroup?.id ?? 'uncategorized'}
            section={section}
            selectedTagId={selectedTagId}
            collapsed={collapsed}
            dropPending={isPending}
            dropReady={isReady}
            onSelect={(id) => selectTag(id)}
            onToggleCollapse={toggleCollapsed}
            onContextMenu={openMenu}
            onTagGroupContextMenu={openTagGroupMenu}
            onRenameTagGroup={(id, label) => void handleRenameTagGroup(id, label)}
            onTagGroupAppearanceChange={(id, patch) => void handleTagGroupAppearanceChange(id, patch)}
          />
        ))}
      </div>

      {draggingTag ? (
        <p className="tag-dnd-hint" role="status">
          Hold over a tag group or tag here to reparent (~{TAG_HOLD_MS / 1000}s). Drop onto a
          subject, thumbnail, or preview to tag media.
        </p>
      ) : null}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}

      {tagGroupMenu && (
        <ContextMenu
          x={tagGroupMenu.x}
          y={tagGroupMenu.y}
          items={tagGroupMenuItems}
          onClose={() => setTagGroupMenu(null)}
        />
      )}

      {newTagRequest && (
        <NewTagModal
          parentId={newTagRequest.parentId}
          parentLabel={newTagRequest.parentLabel}
          tagGroupId={newTagRequest.tagGroupId}
          onClose={() => setNewTagRequest(null)}
          onCreated={(tag) => void onTagCreated(tag)}
        />
      )}

      {showNewTagGroup && (
        <NewTagGroupModal
          onClose={() => setShowNewTagGroup(false)}
          onCreated={() => void refreshTagGroups()}
        />
      )}

      {deleteTagGroup && (
        <ConfirmDialog
          title="Delete tag group?"
          message={`Remove “${deleteTagGroup.label}”? Tags in this group will move to Uncategorized.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => void confirmDeleteTagGroup()}
          onCancel={() => setDeleteTagGroup(null)}
        />
      )}

      {deleteTagRequest && (
        <ConfirmDialog
          title="Delete tag?"
          message={deleteTagMessage}
          confirmLabel="Delete"
          danger
          onConfirm={() => void confirmDeleteTag()}
          onCancel={() => setDeleteTagRequest(null)}
        />
      )}
    </div>
  )
}
