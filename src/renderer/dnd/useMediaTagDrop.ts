import { useDroppable } from '@dnd-kit/core'
import { useTagDnd } from './TagDndContext'
import { mediaDropId, mediaTagsDropId } from './tagDnd'

type MediaTagDropKind = 'media' | 'media-tags'

export function useMediaTagDrop(mediaId: number | null, kind: MediaTagDropKind = 'media') {
  const { draggingTag } = useTagDnd()
  const dropId =
    mediaId != null
      ? kind === 'media-tags'
        ? mediaTagsDropId(mediaId)
        : mediaDropId(mediaId)
      : 'media-drop-disabled'

  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    disabled: mediaId == null,
    data: { type: kind, mediaId }
  })

  const isDropHover = isOver && draggingTag != null && mediaId != null

  return { setNodeRef, isDropHover }
}
