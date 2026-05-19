import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TagGroup } from '../../shared/types'

export interface NewTagGroupModalProps {
  onClose: () => void
  onCreated: (group: TagGroup) => void
}

export function NewTagGroupModal({ onClose, onCreated }: NewTagGroupModalProps) {
  const [label, setLabel] = useState('')
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
    const trimmed = label.trim()
    if (!trimmed) {
      setError('Label is required.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const group = await window.collectionXiewer.tagGroups.create(trimmed)
      onCreated(group)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create tag group.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-dialog"
        role="dialog"
        aria-labelledby="new-tag-group-title"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <h2 id="new-tag-group-title" className="modal-title">
          New tag group
        </h2>
        <p className="modal-hint">
          Tag groups organize related tag trees in the Tags Library (e.g. Species, Locations) without
          a shared parent tag.
        </p>

        <div className="field">
          <label htmlFor="new-tag-group-label">Label</label>
          <input
            id="new-tag-group-label"
            ref={inputRef}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="e.g. Species"
            autoComplete="off"
          />
        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Creating…' : 'Create tag group'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
