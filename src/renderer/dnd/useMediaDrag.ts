import { useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { useAppStore } from '../store/appStore'
import { mediaDragId, type MediaDragData } from './collectionDnd'

export function useMediaDrag(mediaId: number, disabled = false) {
  const selectedMediaIds = useAppStore((s) => s.selectedMediaIds)

  const mediaIds = useMemo(() => {
    if (selectedMediaIds.includes(mediaId) && selectedMediaIds.length > 1) {
      return selectedMediaIds
    }
    return [mediaId]
  }, [mediaId, selectedMediaIds])

  const data: MediaDragData = { type: 'media', mediaId, mediaIds }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: mediaDragId(mediaId),
    data,
    disabled
  })

  return { attributes, listeners, setNodeRef, isDragging, dragCount: mediaIds.length }
}
