import { createContext, useContext } from 'react'
import type { Tag } from '../../shared/types'
import type { MediaTagDragData } from './tagDnd'

export interface TagDndContextValue {
  draggingTag: Tag | null
  draggingMediaTag: MediaTagDragData | null
  draggingMediaId: number | null
  draggingMediaIds: number[]
  isPending: (id: string) => boolean
  isReady: (id: string) => boolean
  setReparentSideEffects: (fn: ((newParentId: number | null) => void) | null) => void
}

export const TagDndContext = createContext<TagDndContextValue | null>(null)

export function useTagDnd(): TagDndContextValue {
  const ctx = useContext(TagDndContext)
  if (!ctx) throw new Error('useTagDnd must be used within TagDndProvider')
  return ctx
}
