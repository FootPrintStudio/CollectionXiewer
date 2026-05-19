import { useDroppable } from '@dnd-kit/core'
import { useTagDnd } from './TagDndContext'
import { collectionPrincipalDropId } from './collectionDnd'

export function useCollectionPrincipalTagDrop(collectionId: number) {
  const { draggingTag } = useTagDnd()

  const { setNodeRef, isOver } = useDroppable({
    id: collectionPrincipalDropId(collectionId),
    data: { type: 'collection-principal', collectionId }
  })

  return {
    setNodeRef,
    isDropHover: isOver && draggingTag != null
  }
}
