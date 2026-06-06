import { useDroppable } from '@dnd-kit/core'
import { previewSubjectDropId } from './tagDnd'

export function usePreviewSubjectDrop(mediaId: number, subjectId: number, enabled = true) {
  const id = previewSubjectDropId(mediaId, subjectId)
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled: !enabled,
    data: { type: 'preview-subject', mediaId, subjectId }
  })
  return { setNodeRef, isDropHover: enabled && isOver }
}
