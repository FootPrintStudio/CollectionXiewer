import { useEffect, useState } from 'react'
import type { Tag } from '../../shared/types'
import { useAppStore } from '../store/appStore'

export function useGalleryThumbTags(): Record<number, Tag[]> {
  const media = useAppStore((s) => s.media)
  const showThumbTagList = useAppStore((s) => s.showThumbTagList)
  const mediaTagsRevision = useAppStore((s) => s.mediaTagsRevision)
  const [map, setMap] = useState<Record<number, Tag[]>>({})

  useEffect(() => {
    if (!showThumbTagList || media.length === 0) {
      setMap({})
      return
    }
    let cancelled = false
    const ids = media.map((m) => m.id)
    void window.collectionXiewer.mediaTags.listForMediaIds(ids).then((result) => {
      if (!cancelled) setMap(result)
    })
    return () => {
      cancelled = true
    }
  }, [media, showThumbTagList, mediaTagsRevision])

  return showThumbTagList ? map : {}
}
