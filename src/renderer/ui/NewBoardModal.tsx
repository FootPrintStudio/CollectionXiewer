import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface NewBoardModalProps {
  onClose: () => void
  onCreated: (fileName: string) => void
}

export function NewBoardModal({ onClose, onCreated }: NewBoardModalProps) {
  const [name, setName] = useState('')
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
      const { fileName } = await window.collectionXiewer.boards.create(trimmed)
      onCreated(fileName)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create board.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-dialog"
        role="dialog"
        aria-labelledby="new-board-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="new-board-title" className="modal-title">
          New design board
        </h2>
        <p className="modal-hint">
          Boards are saved as lightweight JSON in your chosen boards folder. Drag images from the
          gallery onto the canvas.
        </p>
        <div className="field">
          <label htmlFor="new-board-name">Name</label>
          <input
            id="new-board-name"
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="e.g. Character refs"
            autoComplete="off"
          />
        </div>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Creating…' : 'Create board'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
