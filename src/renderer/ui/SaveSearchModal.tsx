import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SavedSearch } from '../../shared/types'
import type { SearchNode } from '../../shared/searchAst'

export interface SaveSearchModalProps {
  queryText: string
  ast: SearchNode
  onClose: () => void
  onSaved: (row: SavedSearch) => void
}

export function SaveSearchModal({ queryText, ast, onClose, onSaved }: SaveSearchModalProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const payload = JSON.stringify({
        v: 2,
        ast,
        queryText
      } satisfies { v: 2; ast: SearchNode; queryText: string })
      const row = (await window.collectionXiewer.search.savedCreate(
        trimmed,
        payload
      )) as SavedSearch
      onSaved(row)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save search.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-dialog"
        role="dialog"
        aria-labelledby="save-search-title"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <h2 id="save-search-title" className="modal-title">
          Save search
        </h2>
        <p className="modal-hint">
          Save the current query for quick access from the Saved menu.
        </p>
        <div className="field">
          <label htmlFor="save-search-name">Name</label>
          <input
            id="save-search-name"
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="e.g. Untagged heroes"
            autoComplete="off"
            disabled={saving}
          />
        </div>
        <div className="field">
          <label>Query</label>
          <code className="save-search-modal__query-preview">{queryText}</code>
        </div>
        {error ? <p className="modal-error">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
