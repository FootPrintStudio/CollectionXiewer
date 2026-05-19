import { useCallback, useEffect, useRef, useState } from 'react'
import type { SavedSearch } from '../../shared/types'
import { parseSavedSearchPayload } from '../../shared/searchAst'
import type { SearchNode } from '../../shared/searchAst'
import { formatSearchQuery, type SearchResolveContext } from '../../shared/searchParser'

interface SavedSearchesMenuProps {
  resolveCtx: SearchResolveContext
  onLoad: (queryText: string, ast: SearchNode) => void
  refreshKey: number
}

export function SavedSearchesMenu({ resolveCtx, onLoad, refreshKey }: SavedSearchesMenuProps) {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<SavedSearch[]>([])
  const menuRef = useRef<HTMLDivElement>(null)

  const reload = useCallback(async () => {
    const rows = (await window.collectionXiewer.search.savedList()) as SavedSearch[]
    setSaved(rows)
  }, [])

  useEffect(() => {
    if (open) void reload()
  }, [open, refreshKey, reload])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const loadItem = (row: SavedSearch) => {
    const { queryText, ast } = parseSavedSearchPayload(row.query_json)
    const text = queryText ?? formatSearchQuery(ast, resolveCtx)
    onLoad(text, ast)
    setOpen(false)
  }

  const deleteItem = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm('Delete this saved search?')) return
    await window.collectionXiewer.search.savedDelete(id)
    void reload()
  }

  return (
    <div className="saved-searches" ref={menuRef}>
      <button
        type="button"
        className="saved-searches__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        Saved
      </button>
      {open ? (
        <div className="saved-searches__panel" role="listbox">
          {saved.length === 0 ? (
            <p className="saved-searches__empty">No saved searches yet.</p>
          ) : (
            <ul className="saved-searches__list">
              {saved.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="saved-searches__load"
                    onClick={() => loadItem(row)}
                  >
                    {row.name}
                  </button>
                  <button
                    type="button"
                    className="saved-searches__delete"
                    title={`Delete "${row.name}"`}
                    onClick={(e) => void deleteItem(e, row.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
