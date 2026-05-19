import { useDroppable } from '@dnd-kit/core'
import { useTagDnd } from './TagDndContext'
import { collectionDropId } from './collectionDnd'

export function useCollectionDrop(collectionId: number) {
  const { draggingMediaIds } = useTagDnd()
  const isMediaDrag = draggingMediaIds.length > 0

  const { setNodeRef, isOver } = useDroppable({
    id: collectionDropId(collectionId),
    data: { type: 'collection', collectionId },
    disabled: !isMediaDrag
  })

  return {
    setNodeRef,
    isDropHover: isOver && draggingMediaIds.length > 0
  }
}
