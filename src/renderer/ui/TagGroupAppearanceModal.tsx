import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { normalizeTagIcon } from '../../shared/tagIcon'
import { TagGlyph } from '../components/TagGlyph'

export interface TagGroupAppearanceModalProps {
  groupLabel: string
  color: string
  icon: string | null
  onClose: () => void
  onSave: (color: string, icon: string | null) => void
}

export function TagGroupAppearanceModal({
  groupLabel,
  color: initialColor,
  icon: initialIcon,
  onClose,
  onSave
}: TagGroupAppearanceModalProps) {
  const [color, setColor] = useState(initialColor)
  const [iconDraft, setIconDraft] = useState(initialIcon ?? '')
  const iconRef = useRef<HTMLInputElement>(null)

  const previewIcon = normalizeTagIcon(iconDraft)

  useEffect(() => {
    iconRef.current?.focus()
    iconRef.current?.select()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const save = () => {
    onSave(color, normalizeTagIcon(iconDraft))
    onClose()
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-dialog modal-dialog--compact tag-group-appearance-modal"
        role="dialog"
        aria-labelledby="tag-group-appearance-title"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <h2 id="tag-group-appearance-title" className="modal-title">
          {groupLabel}
        </h2>
        <p className="modal-hint">Icon and colour apply to this tag group and inherited tags.</p>

        <div
          className="tag-group-appearance-modal__preview"
          style={{
            borderColor: color,
            background: `${color}33`
          }}
        >
          {previewIcon ? (
            <TagGlyph icon={previewIcon} color={color} className="tag-group-appearance-modal__glyph" />
          ) : (
            <span className="tag-group-appearance-modal__placeholder" style={{ color }}>
              ◇
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="tag-group-appearance-icon">Icon (Unicode)</label>
          <input
            id="tag-group-appearance-icon"
            ref={iconRef}
            type="text"
            value={iconDraft}
            maxLength={4}
            spellCheck={false}
            placeholder="e.g. 🐕"
            autoComplete="off"
            onKeyDown={(e) => e.key === 'Enter' && save()}
            onChange={(e) => setIconDraft(e.target.value)}
          />
        </div>

        <div className="field tag-group-appearance-modal__color">
          <label htmlFor="tag-group-appearance-color">Colour</label>
          <div className="tag-group-appearance-modal__color-row">
            <input
              id="tag-group-appearance-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <span className="tag-group-appearance-modal__color-value">{color}</span>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
