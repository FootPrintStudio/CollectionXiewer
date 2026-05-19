import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Tag } from '../../shared/types'
import { tagChipStyle } from '../lib/tagChipStyle'

const DEFAULT_TAG_COLOR = '#8b4513'

export interface NewTagModalProps {
  parentId: number | null
  parentLabel?: string
  tagGroupId?: number | null
  onClose: () => void
  onCreated: (tag: Tag) => void
}

export function NewTagModal({
  parentId,
  parentLabel,
  tagGroupId = null,
  onClose,
  onCreated
}: NewTagModalProps) {
  const [displayName, setDisplayName] = useState('')
  const [disambiguator, setDisambiguator] = useState('')
  const [color, setColor] = useState(DEFAULT_TAG_COLOR)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const title = parentId != null ? `New child of ${parentLabel ?? 'tag'}` : 'New root tag'

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    const name = displayName.trim()
    if (!name) {
      setError('Name is required.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const tag = await window.collectionXiewer.tags.create({
        display_name: name,
        disambiguator: disambiguator.trim() || null,
        parent_id: parentId,
        tag_group_id: parentId == null ? tagGroupId : undefined,
        color: normalizeColor(color) ?? DEFAULT_TAG_COLOR,
        use_custom_color: true
      })
      onCreated(tag)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create tag.')
    } finally {
      setSaving(false)
    }
  }

  const previewColor = toColorInputValue(color)

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-dialog"
        role="dialog"
        aria-labelledby="new-tag-title"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <h2 id="new-tag-title" className="modal-title">
          {title}
        </h2>

        <div className="field">
          <label htmlFor="new-tag-name">Name</label>
          <input
            id="new-tag-name"
            ref={nameRef}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="Display name"
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor="new-tag-dis">Disambiguator (optional)</label>
          <input
            id="new-tag-dis"
            value={disambiguator}
            onChange={(e) => setDisambiguator(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="e.g. city, character"
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor="new-tag-color">Color</label>
          <div className="modal-color-row">
            <input
              id="new-tag-color"
              type="color"
              value={previewColor}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Tag color"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              spellCheck={false}
              className="modal-color-hex"
            />
            <span className="chip" style={tagChipStyle(previewColor)}>
              Preview
            </span>
          </div>
        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Creating…' : 'Create tag'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function normalizeColor(value: string): string | null {
  const v = value.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const [, r, g, b] = v.match(/^#(.)(.)(.)$/)!
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return null
}

function toColorInputValue(value: string): string {
  return normalizeColor(value) ?? DEFAULT_TAG_COLOR
}
