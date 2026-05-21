import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { normalizeExternalUrl, validateExternalLink } from '../../shared/tagExternalLinks'

export interface ExternalLinkRecord {
  id: number
  label: string
  url: string
}

export interface ExternalLinkModalProps {
  entityLabel: string
  link?: ExternalLinkRecord | null
  onClose: () => void
  onSave: (label: string, url: string) => Promise<void>
}

export function ExternalLinkModal({
  entityLabel,
  link,
  onClose,
  onSave
}: ExternalLinkModalProps) {
  const isEdit = link != null
  const [label, setLabel] = useState(link?.label ?? '')
  const [url, setUrl] = useState(link?.url ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    labelRef.current?.focus()
    if (isEdit) labelRef.current?.select()
  }, [isEdit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    const normalizedUrl = normalizeExternalUrl(url)
    const validation = validateExternalLink(label, normalizedUrl)
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSave(label.trim(), normalizedUrl)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save link.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-dialog modal-dialog--compact tag-external-link-modal"
        role="dialog"
        aria-labelledby="external-link-modal-title"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <h2 id="external-link-modal-title" className="modal-title">
          {isEdit ? 'Edit link' : 'Add link'} — {entityLabel}
        </h2>
        <p className="modal-hint">Opens in your default browser when clicked from the details panel.</p>

        <div className="field">
          <label htmlFor="external-link-label">Label</label>
          <input
            id="external-link-label"
            ref={labelRef}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="e.g. Wikipedia, artist page"
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor="external-link-url">URL</label>
          <input
            id="external-link-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="https://…"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {error ? <p className="modal-error">{error}</p> : null}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" disabled={saving} onClick={() => void submit()}>
            {saving ? 'Saving…' : isEdit ? 'Save' : 'Add link'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
