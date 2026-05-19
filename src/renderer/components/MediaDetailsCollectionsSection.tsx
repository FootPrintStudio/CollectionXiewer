import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import type { Collection, CollectionWithStats } from '../../shared/types'
import { SectionHelp } from '../ui/SectionHelp'

interface Props {
  mediaId: number
  memberCollections: Collection[]
  allCollections: CollectionWithStats[]
  onMembersChange: (members: Collection[]) => void
  onOpenCollection: (collectionId: number) => void
  onMembershipChanged: () => void
}

export function MediaDetailsCollectionsSection({
  mediaId,
  memberCollections,
  allCollections,
  onMembersChange,
  onOpenCollection,
  onMembershipChanged
}: Props) {
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchHits, setSearchHits] = useState<Collection[] | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const searchGenRef = useRef(0)

  const memberIds = useMemo(() => new Set(memberCollections.map((c) => c.id)), [memberCollections])

  const suggestions = useMemo(() => {
    const pool = searchHits ?? allCollections
    return pool
      .filter((c) => !memberIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .slice(0, 20)
  }, [searchHits, allCollections, memberIds])

  const runSearch = useCallback(async (q: string) => {
    const gen = ++searchGenRef.current
    const trimmed = q.trim()
    if (!trimmed) {
      setSearchHits(null)
      return
    }
    const hits = (await window.collectionXiewer.collections.search(trimmed)) as Collection[]
    if (gen === searchGenRef.current) setSearchHits(hits)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const addToCollection = async (collectionId: number) => {
    await window.collectionXiewer.collections.addMember(collectionId, mediaId)
    onMembershipChanged()
    const next = await window.collectionXiewer.collections.forMedia(mediaId)
    onMembersChange(next)
    setQuery('')
    setSearchHits(null)
    setMenuOpen(false)
  }

  const removeFromCollection = async (collectionId: number) => {
    await window.collectionXiewer.collections.removeMember(collectionId, mediaId)
    onMembershipChanged()
    const next = await window.collectionXiewer.collections.forMedia(mediaId)
    onMembersChange(next)
  }

  const showMenu = menuOpen && suggestions.length > 0
  const allMembers =
    allCollections.length > 0 && memberCollections.length >= allCollections.length

  return (
    <section className="media-details-section media-collections-section" aria-label="Collections">
      <p className="panel-title">
        Collections
        <SectionHelp label="Collections help">
          Add this file to curated albums, or drag thumbnails onto a collection in the Collections
          Library.
        </SectionHelp>
      </p>

      <div className="media-collections-section__chips" aria-label="Member collections">
        {memberCollections.length === 0 ? (
          <span className="media-collections-section__empty">Not in any collection</span>
        ) : (
          [...memberCollections]
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
            .map((col) => (
            <span key={col.id} className="chip collection-member-chip">
              <FolderOpen size={12} className="collection-member-chip__icon" aria-hidden />
              <button
                type="button"
                className="collection-member-chip__label"
                onClick={() => onOpenCollection(col.id)}
              >
                {col.name}
              </button>
              <button
                type="button"
                className="collection-member-chip__remove"
                aria-label={`Remove from ${col.name}`}
                onClick={() => void removeFromCollection(col.id)}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      {allCollections.length === 0 ? (
        <p className="empty-hint">No collections yet. Create one in the Collections Library.</p>
      ) : (
        <div className="media-collections-picker" ref={pickerRef}>
          <input
            type="search"
            className="media-collections-picker__input"
            placeholder="Search collections to add…"
            value={query}
            autoComplete="off"
            aria-expanded={showMenu}
            aria-controls="media-collections-picker-menu"
            aria-autocomplete="list"
            onChange={(e) => {
              const v = e.target.value
              setQuery(v)
              setMenuOpen(true)
              void runSearch(v)
            }}
            onFocus={() => setMenuOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setMenuOpen(false)
                return
              }
              if (e.key === 'Enter' && suggestions[0]) {
                e.preventDefault()
                void addToCollection(suggestions[0].id)
              }
            }}
          />
          {showMenu ? (
            <ul
              id="media-collections-picker-menu"
              className="media-collections-picker__menu"
              role="listbox"
            >
              {suggestions.map((col) => (
                <li key={col.id} role="presentation">
                  <button
                    type="button"
                    className="media-collections-picker__option"
                    role="option"
                    onClick={() => void addToCollection(col.id)}
                  >
                    {col.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : menuOpen && suggestions.length === 0 ? (
            <p className="media-collections-picker__empty">
              {query.trim()
                ? 'No matching collections'
                : allMembers
                  ? 'Already in all collections'
                  : 'Type to search collections'}
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}
