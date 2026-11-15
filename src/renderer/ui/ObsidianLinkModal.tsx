import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  buildObsidianOpenUrl,
  loadDefaultObsidianVault,
  parseObsidianOpenUrl,
  saveDefaultObsidianVault,
  validateObsidianLink
} from '../../shared/obsidianLinks'

export interface ObsidianLinkRecord {
  id: number
  label: string
  url: string
}

interface Props {
  entityLabel: string
  link?: ObsidianLinkRecord | null
  onClose: () => void
  onSave: (label: string, url: string) => Promise<void>
}

export function ObsidianLinkModal({ entityLabel, link, onClose, onSave }: Props) {
  const isEdit = link != null
  const existing = link ? parseObsidianOpenUrl(link.url) : null
  const [label, setLabel] = useState(link?.label ?? '')
  const [vault, setVault] = useState(existing?.vault || loadDefaultObsidianVault())
  const [file, setFile] = useState(existing?.file ?? '')
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
    const validation = validateObsidianLink(label, vault, file)
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    setSaving(true)
    try {
      const url = buildObsidianOpenUrl(vault, file)
      saveDefaultObsidianVault(vault)
      await onSave(label.trim(), url)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save Obsidian link.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-dialog modal-dialog--compact tag-external-link-modal"
        role="dialog"
        aria-labelledby="obsidian-link-modal-title"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="obsidian-link-modal-title" className="modal-title">
          {isEdit ? 'Edit Obsidian page' : 'Add Obsidian page'} — {entityLabel}
        </h2>
        <p className="modal-hint">
          Opens the note in Obsidian via{' '}
          <code>obsidian://open?vault=…&amp;file=…</code>. Vault name is optional if only one vault
          is open.
        </p>

        <div className="field">
          <label htmlFor="obsidian-link-label">Label</label>
          <input
            id="obsidian-link-label"
            ref={labelRef}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="e.g. Lexicon entry, character page"
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor="obsidian-link-vault">Vault name</label>
          <input
            id="obsidian-link-vault"
            value={vault}
            onChange={(e) => setVault(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="e.g. Test Vault"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label htmlFor="obsidian-link-file">Note path</label>
          <input
            id="obsidian-link-file"
            value={file}
            onChange={(e) => setFile(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="Folder/Note name (no .md required)"
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
            {saving ? 'Saving…' : isEdit ? 'Save' : 'Add page'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
