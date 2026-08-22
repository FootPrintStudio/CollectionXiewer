import { useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { useAppStore } from '../store/appStore'
import { mediaDragId, type MediaDragData } from './collectionDnd'

export function useMediaDrag(mediaId: number, disabled = false) {
  const isSelected = useAppStore((s) => s.selectedMediaIds.includes(mediaId))
  const selectedCount = useAppStore((s) =>
    s.selectedMediaIds.includes(mediaId) ? s.selectedMediaIds.length : 0
  )

  const mediaIds = useMemo(() => {
    if (isSelected && selectedCount > 1) {
      return useAppStore.getState().selectedMediaIds
    }
    return [mediaId]
  }, [mediaId, isSelected, selectedCount])

  const data: MediaDragData = { type: 'media', mediaId, mediaIds }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: mediaDragId(mediaId),
    data,
    disabled
  })

  return { attributes, listeners, setNodeRef, isDragging, dragCount: mediaIds.length }
}
