import { useEffect, useMemo, useRef, useState } from 'react'
import type { Tag } from '../../shared/types'
import { useAppStore } from '../store/appStore'

function idsKey(ids: number[]): string {
  return ids.slice().sort((a, b) => a - b).join(',')
}

/** Fetch thumb tags for currently visible (mounted) media ids only. */
export function useGalleryThumbTags(visibleIds: number[]): Record<number, Tag[]> {
  const showThumbTagList = useAppStore((s) => s.showThumbTagList)
  const mediaTagsRevision = useAppStore((s) => s.mediaTagsRevision)
  const [map, setMap] = useState<Record<number, Tag[]>>({})
  const cacheRef = useRef<{ revision: number; data: Record<number, Tag[]> }>({
    revision: -1,
    data: {}
  })
  const key = useMemo(() => idsKey(visibleIds), [visibleIds])

  useEffect(() => {
    if (!showThumbTagList) {
      setMap({})
      cacheRef.current = { revision: -1, data: {} }
      return
    }
    if (visibleIds.length === 0) return

    const revisionChanged = cacheRef.current.revision !== mediaTagsRevision
    if (revisionChanged) {
      cacheRef.current = { revision: mediaTagsRevision, data: {} }
    }

    const needFetch = visibleIds.filter((id) => cacheRef.current.data[id] === undefined)
    if (needFetch.length === 0) {
      const next: Record<number, Tag[]> = {}
      for (const id of visibleIds) next[id] = cacheRef.current.data[id] ?? []
      setMap(next)
      return
    }

    let cancelled = false
    void window.collectionXiewer.mediaTags.listForMediaIds(needFetch).then((result) => {
      if (cancelled) return
      cacheRef.current.data = { ...cacheRef.current.data, ...result }
      cacheRef.current.revision = mediaTagsRevision
      const next: Record<number, Tag[]> = {}
      for (const id of visibleIds) next[id] = cacheRef.current.data[id] ?? []
      setMap(next)
    })
    return () => {
      cancelled = true
    }
  }, [key, visibleIds, showThumbTagList, mediaTagsRevision])

  return showThumbTagList ? map : {}
}
