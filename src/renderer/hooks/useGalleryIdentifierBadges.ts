import { useEffect, useState } from 'react'
import type { IdentifierBadge } from '../../shared/types'
import { useAppStore } from '../store/appStore'

export function useGalleryIdentifierBadges(): Record<number, IdentifierBadge[]> {
  const media = useAppStore((s) => s.media)
  const showIdentifiers = useAppStore((s) => s.showIdentifiers)
  const identifiersRevision = useAppStore((s) => s.identifiersRevision)
  const searchAst = useAppStore((s) => s.searchAst)
  const searchQueryText = useAppStore((s) => s.searchQueryText)
  const selectedCollectionId = useAppStore((s) => s.selectedCollectionId)
  const [map, setMap] = useState<Record<number, IdentifierBadge[]>>({})

  useEffect(() => {
    if (!showIdentifiers || media.length === 0) {
      setMap({})
      return
    }
    let cancelled = false
    const ids = media.map((m) => m.id)
    void window.collectionXiewer.identifiers.badgesForMediaIds(ids).then((result) => {
      if (!cancelled) setMap(result)
    })
    return () => {
      cancelled = true
    }
  }, [
    media,
    showIdentifiers,
    identifiersRevision,
    searchAst,
    searchQueryText,
    selectedCollectionId
  ])

  return showIdentifiers ? map : {}
}
