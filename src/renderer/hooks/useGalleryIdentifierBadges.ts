import { useEffect, useMemo, useRef, useState } from 'react'
import type { IdentifierBadge } from '../../shared/types'
import { useAppStore } from '../store/appStore'

function idsKey(ids: number[]): string {
  return ids.slice().sort((a, b) => a - b).join(',')
}

/** Fetch identifier badges for currently visible (mounted) media ids only. */
export function useGalleryIdentifierBadges(
  visibleIds: number[]
): Record<number, IdentifierBadge[]> {
  const showIdentifiers = useAppStore((s) => s.showIdentifiers)
  const identifiersRevision = useAppStore((s) => s.identifiersRevision)
  const searchAst = useAppStore((s) => s.searchAst)
  const searchQueryText = useAppStore((s) => s.searchQueryText)
  const selectedCollectionId = useAppStore((s) => s.selectedCollectionId)
  const [map, setMap] = useState<Record<number, IdentifierBadge[]>>({})
  const cacheRef = useRef<{
    stamp: string
    data: Record<number, IdentifierBadge[]>
  }>({ stamp: '', data: {} })

  const key = useMemo(() => idsKey(visibleIds), [visibleIds])
  const stamp = `${identifiersRevision}|${searchAst}|${searchQueryText}|${selectedCollectionId ?? ''}`

  useEffect(() => {
    if (!showIdentifiers) {
      setMap({})
      cacheRef.current = { stamp: '', data: {} }
      return
    }
    if (visibleIds.length === 0) return

    const stampChanged = cacheRef.current.stamp !== stamp
    if (stampChanged) {
      cacheRef.current = { stamp, data: {} }
    }

    const needFetch = visibleIds.filter(
      (id) => stampChanged || cacheRef.current.data[id] === undefined
    )
    if (needFetch.length === 0) {
      const next: Record<number, IdentifierBadge[]> = {}
      for (const id of visibleIds) next[id] = cacheRef.current.data[id] ?? []
      setMap(next)
      return
    }

    let cancelled = false
    void window.collectionXiewer.identifiers.badgesForMediaIds(needFetch).then((result) => {
      if (cancelled) return
      cacheRef.current.data = { ...cacheRef.current.data, ...result }
      cacheRef.current.stamp = stamp
      const next: Record<number, IdentifierBadge[]> = {}
      for (const id of visibleIds) next[id] = cacheRef.current.data[id] ?? []
      setMap(next)
    })
    return () => {
      cancelled = true
    }
  }, [key, visibleIds, showIdentifiers, stamp])

  return showIdentifiers ? map : {}
}
