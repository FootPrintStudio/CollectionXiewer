import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Collection } from '../../shared/types'

export interface NewCollectionModalProps {
  onClose: () => void
  onCreated: (collection: Collection) => void
}

export function NewCollectionModal({ onClose, onCreated }: NewCollectionModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const collection = await window.collectionXiewer.collections.create(
        trimmed,
        description.trim() || undefined
      )
      onCreated(collection)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create collection.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-dialog"
        role="dialog"
        aria-labelledby="new-collection-title"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <h2 id="new-collection-title" className="modal-title">
          New collection
        </h2>
        <p className="modal-hint">
          Collections are curated albums of media. Drag thumbnails onto a collection in the
          library, or add media from the details panel.
        </p>

        <div className="field">
          <label htmlFor="new-collection-name">Name</label>
          <input
            id="new-collection-name"
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="e.g. Favorites"
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor="new-collection-desc">Description (optional)</label>
          <textarea
            id="new-collection-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Short note about this collection…"
          />
        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Creating…' : 'Create collection'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
