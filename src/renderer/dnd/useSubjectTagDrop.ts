import { useDroppable } from '@dnd-kit/core'
import { subjectDropId } from './tagDnd'

export function useSubjectTagDrop(mediaId: number, subjectId: number) {
  const id = subjectDropId(mediaId, subjectId)
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: 'subject', mediaId, subjectId } })
  return { setNodeRef, isDropHover: isOver }
}
