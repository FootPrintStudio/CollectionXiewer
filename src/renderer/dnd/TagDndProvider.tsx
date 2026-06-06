import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { canAssignTagToGroup, canReparentTag } from '../../shared/tagTree'
import { tagChipStyle } from '../lib/tagChipStyle'
import { useResolvedTagColor } from '../hooks/useResolvedTagColor'
import { TagChipContent } from '../components/TagChipContent'
import { applyTagFromLibraryDrop } from '../lib/applyTagFromDrop'
import { moveMediaTagToSubject } from '../lib/moveMediaTag'
import { useAppStore } from '../store/appStore'
import { useDelayedDropTarget } from '../hooks/useDelayedDropTarget'
import { snapCenterToCursor } from './snapCenterToCursor'
import { TagDndContext } from './TagDndContext'
import type { Tag } from '../../shared/types'
import { galleryCollisionDetection } from './collisionDetection'
import {
  parseCollectionDropId,
  parseCollectionPrincipalDropId,
  type MediaDragData
} from './collectionDnd'
import { addPrincipalTagToCollection } from '../lib/collectionPrincipalTags'
import {
  TAG_HOLD_MS,
  isTagReparentDropId,
  isSearchBarDropId,
  parseMediaTagDropTarget,
  parseTagGroupDropId,
  parseTagDragId,
  parseTagDropId,
  type MediaTagDragData,
  type TagDragData
} from './tagDnd'
import { isBoardDropId } from './boardDnd'
import { useBoardStore } from '../store/boardStore'
import { showError } from '../store/toastStore'
import { createPointerScopedAutoScroll } from './pointerScopedAutoScroll'

type ReparentTarget =
  | { kind: 'parent'; parentId: number | null }
  | { kind: 'tagGroup'; tagGroupId: number | null }

export function TagDndProvider({ children }: { children: ReactNode }) {
  const tags = useAppStore((s) => s.tags)
  const refreshTags = useAppStore((s) => s.refreshTags)

  const [draggingTag, setDraggingTag] = useState<Tag | null>(null)
  const [draggingMediaTag, setDraggingMediaTag] = useState<MediaTagDragData | null>(null)
  const [draggingMediaIds, setDraggingMediaIds] = useState<number[]>([])
  const refreshCollections = useAppStore((s) => s.refreshCollections)
  const bumpCollectionMembersRevision = useAppStore((s) => s.bumpCollectionMembersRevision)
  const bumpCollectionDetailsRevision = useAppStore((s) => s.bumpCollectionDetailsRevision)
  const refreshMedia = useAppStore((s) => s.refreshMedia)
  const selectedCollectionId = useAppStore((s) => s.selectedCollectionId)
  const reparentSideEffectsRef = useRef<((newParentId: number | null) => void) | null>(null)

  const { arm, clear, isPending, isReady, getCommittedTarget } = useDelayedDropTarget(TAG_HOLD_MS)
  const pointerAutoScroll = useMemo(() => createPointerScopedAutoScroll(), [])

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])
  const overlayColor = useResolvedTagColor(draggingTag)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const setReparentSideEffects = useCallback(
    (fn: ((newParentId: number | null) => void) | null) => {
      reparentSideEffectsRef.current = fn
    },
    []
  )

  const resolveReparentTarget = useCallback((overId: string): ReparentTarget | undefined => {
    const tagGroupId = parseTagGroupDropId(overId)
    if (tagGroupId !== undefined) {
      return { kind: 'tagGroup', tagGroupId }
    }
    const tagId = parseTagDropId(overId)
    if (tagId != null) return { kind: 'parent', parentId: tagId }
    return undefined
  }, [])

  const updateReparentHold = useCallback(
    (draggedId: number | null, overId: string | null) => {
      if (draggedId == null || overId == null || !isTagReparentDropId(overId)) {
        clear()
        return
      }
      const target = resolveReparentTarget(overId)
      if (!target) {
        clear()
        return
      }
      if (target.kind === 'tagGroup') {
        if (!canAssignTagToGroup(draggedId, target.tagGroupId, tags)) {
          clear()
          return
        }
      } else if (!canReparentTag(draggedId, target.parentId, tags)) {
        clear()
        return
      }
      arm(overId)
    },
    [arm, clear, resolveReparentTarget, tags]
  )

  const onDragStart = (event: DragStartEvent) => {
    pointerAutoScroll.trackDragStart(event)
    const data = event.active.data.current as
      | TagDragData
      | MediaTagDragData
      | MediaDragData
      | undefined
    if (data?.type === 'media') {
      setDraggingMediaIds(data.mediaIds)
      setDraggingMediaTag(null)
      setDraggingTag(null)
    } else if (data?.type === 'media-tag') {
      setDraggingMediaIds([])
      setDraggingMediaTag(data)
      setDraggingTag(tagsById.get(data.tagId) ?? null)
    } else if (data?.type === 'tag') {
      setDraggingMediaIds([])
      setDraggingMediaTag(null)
      setDraggingTag(tagsById.get(data.tagId) ?? null)
    }
    clear()
  }

  const onDragMove = (event: DragMoveEvent) => {
    pointerAutoScroll.trackDragMove(event)
  }

  const onDragOver = (event: DragOverEvent) => {
    const draggedId = parseTagDragId(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    updateReparentHold(draggedId, overId)
  }

  const onDragEnd = async (event: DragEndEvent) => {
    pointerAutoScroll.clearPointer()
    const activeData = event.active.data.current as
      | TagDragData
      | MediaTagDragData
      | MediaDragData
      | undefined
    const overId = event.over ? String(event.over.id) : null
    const dropTarget = overId ? parseMediaTagDropTarget(overId) : null
    const collectionId = overId ? parseCollectionDropId(overId) : null

    setDraggingTag(null)
    setDraggingMediaTag(null)
    setDraggingMediaIds([])

    if (activeData?.type === 'media' && overId && isBoardDropId(overId)) {
      clear()
      const { activeFile, dropWorldAt, addMediaItems } = useBoardStore.getState()
      if (activeFile) {
        addMediaItems(activeData.mediaIds, dropWorldAt ?? { x: 120, y: 120 })
        useAppStore.getState().setMainView('board')
      }
      return
    }

    if (activeData?.type === 'media' && collectionId != null) {
      clear()
      try {
        for (const mediaId of activeData.mediaIds) {
          await window.collectionXiewer.collections.addMember(collectionId, mediaId)
        }
        bumpCollectionMembersRevision()
        await refreshCollections()
        if (selectedCollectionId === collectionId) await refreshMedia()
      } catch (e) {
        showError(e)
      }
      return
    }

    if (activeData?.type === 'media-tag') {
      clear()
      if (
        dropTarget?.subjectId != null &&
        dropTarget.mediaId === activeData.mediaId &&
        dropTarget.subjectId !== activeData.sourceSubjectId
      ) {
        try {
          await moveMediaTagToSubject(
            activeData.mediaId,
            activeData.tagId,
            activeData.sourceSubjectId,
            dropTarget.subjectId
          )
        } catch (e) {
          showError(e)
        }
      }
      return
    }

    const draggedId = parseTagDragId(event.active.id)
    if (draggedId == null) {
      clear()
      return
    }

    if (overId && isSearchBarDropId(overId) && activeData?.type === 'tag') {
      clear()
      return
    }

    const collectionPrincipalId = overId ? parseCollectionPrincipalDropId(overId) : null
    if (collectionPrincipalId != null) {
      clear()
      try {
        await addPrincipalTagToCollection(collectionPrincipalId, draggedId)
        bumpCollectionDetailsRevision()
      } catch (e) {
        showError(e)
      }
      return
    }

    if (dropTarget != null) {
      clear()
      try {
        await applyTagFromLibraryDrop(draggedId, dropTarget)
      } catch (e) {
        showError(e)
      }
      return
    }

    const dropTargetId = getCommittedTarget()
    clear()

    if (dropTargetId == null) return

    const target = resolveReparentTarget(dropTargetId)
    if (!target) return

    try {
      if (target.kind === 'tagGroup') {
        if (!canAssignTagToGroup(draggedId, target.tagGroupId, tags)) return
        await window.collectionXiewer.tags.assignGroup(draggedId, target.tagGroupId)
        reparentSideEffectsRef.current?.(null)
      } else {
        if (!canReparentTag(draggedId, target.parentId, tags)) return
        await window.collectionXiewer.tags.setParent(draggedId, target.parentId)
        reparentSideEffectsRef.current?.(target.parentId)
      }
      await refreshTags()
    } catch (e) {
      showError(e)
    }
  }

  const onDragCancel = () => {
    pointerAutoScroll.clearPointer()
    setDraggingTag(null)
    setDraggingMediaTag(null)
    setDraggingMediaIds([])
    clear()
  }

  const draggingMediaId = draggingMediaIds[0] ?? null

  const contextValue = useMemo(
    () => ({
      draggingTag,
      draggingMediaTag,
      draggingMediaId,
      draggingMediaIds,
      isPending,
      isReady,
      setReparentSideEffects
    }),
    [draggingTag, draggingMediaTag, draggingMediaId, draggingMediaIds, isPending, isReady, setReparentSideEffects]
  )

  return (
    <TagDndContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={galleryCollisionDetection}
        measuring={{
          droppable: { strategy: MeasuringStrategy.Always }
        }}
        modifiers={[snapCenterToCursor]}
        autoScroll={pointerAutoScroll.autoScroll}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragOver={onDragOver}
        onDragEnd={(e) => void onDragEnd(e)}
        onDragCancel={onDragCancel}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {draggingTag ? (
            <span className="chip tag-tree-chip tag-drag-overlay" style={tagChipStyle(overlayColor)}>
              <TagChipContent tag={draggingTag} />
            </span>
          ) : draggingMediaIds.length > 0 ? (
            <span className="media-drag-overlay">
              {draggingMediaIds.length === 1
                ? '1 item'
                : `${draggingMediaIds.length} items`}
            </span>
          ) : null}
        </DragOverlay>
      </DndContext>
    </TagDndContext.Provider>
  )
}
