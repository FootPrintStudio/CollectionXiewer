import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { isUniversalSubjectLabel } from '../../shared/subjects'

export interface NewSubjectModalProps {
  mediaId: number
  existingLabels: string[]
  onClose: () => void
  onCreated: (subjectId: number, label: string) => void
}

export function NewSubjectModal({
  mediaId,
  existingLabels,
  onClose,
  onCreated
}: NewSubjectModalProps) {
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
    if (isUniversalSubjectLabel(trimmed)) {
      setError('“Universal” is reserved for the default subject.')
      return
    }
    const exists = existingLabels.some((l) => l.toLowerCase() === trimmed.toLowerCase())
    if (exists) {
      setError('A subject with this label already exists for this media item.')
      return
    }

    setError(null)
    setSaving(true)
    try {
      const subjectId = await window.collectionXiewer.subjects.add(mediaId, trimmed)
      onCreated(subjectId, trimmed)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create subject.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-dialog"
        role="dialog"
        aria-labelledby="new-subject-title"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <h2 id="new-subject-title" className="modal-title">
          New subject
        </h2>
        <p className="modal-hint">
          Subjects let you tag the same media in different contexts (e.g. scene vs. character).
        </p>

        <div className="field">
          <label htmlFor="new-subject-label">Label</label>
          <input
            id="new-subject-label"
            ref={inputRef}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="e.g. Scene, Character, Mood"
            autoComplete="off"
          />
        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Creating…' : 'Create subject'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
