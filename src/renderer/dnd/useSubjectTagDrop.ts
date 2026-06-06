import { useDroppable } from '@dnd-kit/core'
import { subjectDropId } from './tagDnd'

export function useSubjectTagDrop(mediaId: number, subjectId: number, enabled = true) {
  const id = subjectDropId(mediaId, subjectId)
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled: !enabled,
    data: { type: 'subject', mediaId, subjectId }
  })
  return { setNodeRef, isDropHover: enabled && isOver }
}
