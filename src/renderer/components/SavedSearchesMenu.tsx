import { useCallback, useEffect, useRef, useState } from 'react'
import type { SavedSearch } from '../../shared/types'
import { parseSavedSearchPayload } from '../../shared/searchAst'
import type { SearchNode } from '../../shared/searchAst'
import { formatSearchQuery, type SearchResolveContext } from '../../shared/searchParser'

interface SavedSearchesMenuProps {
  resolveCtx: SearchResolveContext
  onLoad: (row: SavedSearch, queryText: string, ast: SearchNode) => void
  onUpdateRow: (id: number) => void
  refreshKey: number
}

export function SavedSearchesMenu({
  resolveCtx,
  onLoad,
  onUpdateRow,
  refreshKey
}: SavedSearchesMenuProps) {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<SavedSearch[]>([])
  const menuRef = useRef<HTMLDivElement>(null)

  const reload = useCallback(async () => {
    const rows = (await window.collectionXiewer.search.savedList()) as SavedSearch[]
    setSaved(rows)
  }, [])

  useEffect(() => {
    void reload()
  }, [refreshKey, reload])

  useEffect(() => {
    if (open) void reload()
  }, [open, reload])

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
    onLoad(row, text, ast)
    setOpen(false)
  }

  const renameItem = async (e: React.MouseEvent, row: SavedSearch) => {
    e.stopPropagation()
    const next = prompt('Saved search name', row.name)
    if (!next?.trim() || next.trim() === row.name) return
    await window.collectionXiewer.search.savedUpdate(row.id, { name: next.trim() })
    void reload()
  }

  const updateItem = (e: React.MouseEvent, row: SavedSearch) => {
    e.stopPropagation()
    if (!confirm(`Overwrite “${row.name}” with the current query?`)) return
    onUpdateRow(row.id)
    void reload()
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
                <li key={row.id} className="saved-searches__row">
                  <button
                    type="button"
                    className="saved-searches__load"
                    onClick={() => loadItem(row)}
                  >
                    {row.name}
                  </button>
                  <div className="saved-searches__row-actions">
                    <button
                      type="button"
                      className="saved-searches__rename"
                      title={`Rename “${row.name}”`}
                      onClick={(e) => void renameItem(e, row)}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="saved-searches__update"
                      title={`Update “${row.name}” with current query`}
                      onClick={(e) => updateItem(e, row)}
                    >
                      Update
                    </button>
                    <button
                      type="button"
                      className="saved-searches__delete"
                      title={`Delete "${row.name}"`}
                      onClick={(e) => void deleteItem(e, row.id)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
