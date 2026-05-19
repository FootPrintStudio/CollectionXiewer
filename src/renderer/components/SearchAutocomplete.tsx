import { useEffect, useState } from 'react'
import type { Collection, CollectionWithStats, Tag, WatchRoot } from '../../shared/types'
import { formatTagLabel } from '../../shared/tagDisplay'
import {
  applyCompletion,
  detectActiveCompletion,
  type ActiveCompletion
} from '../lib/searchAutocomplete'

export interface SuggestionItem {
  label: string
  insert: string
}

interface SearchAutocompleteProps {
  text: string
  cursor: number
  tags: Tag[]
  collections: CollectionWithStats[]
  roots: WatchRoot[]
  onApply: (nextText: string, nextCursor: number) => void
}

export function SearchAutocomplete({
  text,
  cursor,
  tags,
  collections,
  roots,
  onApply
}: SearchAutocompleteProps) {
  const [active, setActive] = useState<ActiveCompletion | null>(null)
  const [items, setItems] = useState<SuggestionItem[]>([])
  const [highlight, setHighlight] = useState(0)

  useEffect(() => {
    const a = detectActiveCompletion(text, cursor)
    setActive(a)
    setHighlight(0)
    if (!a) {
      setItems([])
      return
    }

    let cancelled = false
    void (async () => {
      const suggestions = await fetchSuggestions(a, tags, collections, roots)
      if (!cancelled) setItems(suggestions.slice(0, 25))
    })()

    return () => {
      cancelled = true
    }
  }, [text, cursor, tags, collections, roots])

  if (!active || items.length === 0) return null

  const pick = (item: SuggestionItem) => {
    const { text: nextText, cursor: nextCursor } = applyCompletion(text, active, item.insert)
    onApply(nextText, nextCursor)
    setItems([])
  }

  return (
    <ul className="search-autocomplete" role="listbox">
      {items.map((item, i) => (
        <li key={`${item.insert}-${i}`} role="option" aria-selected={i === highlight}>
          <button
            type="button"
            className={i === highlight ? 'search-autocomplete__item search-autocomplete__item--active' : 'search-autocomplete__item'}
            onMouseDown={(e) => {
              e.preventDefault()
              pick(item)
            }}
            onMouseEnter={() => setHighlight(i)}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  )
}

async function fetchSuggestions(
  active: ActiveCompletion,
  tags: Tag[],
  collections: CollectionWithStats[],
  roots: WatchRoot[]
): Promise<SuggestionItem[]> {
  const q = active.partial
  const api = window.collectionXiewer

  switch (active.clause) {
    case 'tag':
    case 'suggested':
    case 'principal': {
      const hits = q.trim() ? await api.tags.search(q.trim()) : tags.slice(0, 30)
      return hits.map((t) => ({
        label: formatTagLabel(t),
        insert: t.slug
      }))
    }
    case 'collection': {
      const hits: Collection[] = q.trim()
        ? ((await api.collections.search(q.trim())) as Collection[])
        : collections.slice(0, 30)
      return hits.map((c) => ({
        label: c.name,
        insert: c.name
      }))
    }
    case 'folder': {
      const normQ = q.replace(/\\/g, '/').toLowerCase()
      return roots
        .filter((r) => !normQ || r.path.replace(/\\/g, '/').toLowerCase().includes(normQ))
        .slice(0, 20)
        .map((r) => ({
          label: r.path,
          insert: r.path
        }))
    }
    case 'wiki':
      return []
    default:
      return []
  }
}
