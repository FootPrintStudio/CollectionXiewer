import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Identifier } from '../../shared/types'
import { IDENTIFIER_EDITOR_LAYER } from '../lib/modalLayer'
import { useAppStore } from '../store/appStore'
import { SearchAutocomplete } from './SearchAutocomplete'

export interface IdentifierEditorModalProps {
  identifier: Identifier | null
  onClose: () => void
  onSaved: () => void
}

export function IdentifierEditorModal({ identifier, onClose, onSaved }: IdentifierEditorModalProps) {
  const [label, setLabel] = useState(identifier?.label ?? '')
  const [icon, setIcon] = useState(identifier?.icon ?? '●')
  const [color, setColor] = useState(identifier?.color ?? '#e74c3c')
  const [queryText, setQueryText] = useState(identifier?.query_text ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [queryCursor, setQueryCursor] = useState(0)
  const labelRef = useRef<HTMLInputElement>(null)
  const queryRef = useRef<HTMLInputElement>(null)
  const tags = useAppStore((s) => s.tags)
  const collections = useAppStore((s) => s.collections)
  const roots = useAppStore((s) => s.roots)

  useEffect(() => {
    labelRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, saving])

  const submit = async () => {
    setError(null)
    const trimmedLabel = label.trim()
    const trimmedIcon = icon.trim()
    const trimmedQuery = queryText.trim()
    if (!trimmedLabel) {
      setError('Label is required.')
      return
    }
    if (!trimmedIcon) {
      setError('Icon is required.')
      return
    }
    if ([...trimmedIcon].length > 4) {
      setError('Use at most 4 characters for the icon.')
      return
    }
    const validation = await window.collectionXiewer.identifiers.validateQuery(trimmedQuery)
    if ('error' in validation) {
      setError(validation.error)
      return
    }
    setSaving(true)
    try {
      const input = {
        label: trimmedLabel,
        icon: trimmedIcon,
        color,
        query_text: trimmedQuery
      }
      if (identifier) {
        await window.collectionXiewer.identifiers.update(identifier.id, input)
      } else {
        await window.collectionXiewer.identifiers.create(input)
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="modal-backdrop modal-backdrop--stack"
      data-modal-layer={IDENTIFIER_EDITOR_LAYER}
      onClick={saving ? undefined : onClose}
      role="presentation"
    >
      <div
        className="modal-dialog identifier-editor-modal"
        role="dialog"
        aria-labelledby="identifier-editor-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="identifier-editor-title" className="modal-title">
          {identifier ? 'Edit identifier' : 'New identifier'}
        </h2>
        <p className="modal-hint identifier-editor-modal__intro">
          Define a coloured icon and search rule. Matching gallery thumbnails show the icon at the
          top-left.
        </p>

        <div className="field">
          <label htmlFor="identifier-label">Label</label>
          <input
            id="identifier-label"
            ref={labelRef}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={saving}
            placeholder="e.g. Untagged"
          />
        </div>

        <div className="identifier-editor-modal__icon-row">
          <div className="field identifier-editor-modal__icon-field">
            <label htmlFor="identifier-icon">Icon (Unicode)</label>
            <input
              id="identifier-icon"
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={8}
              disabled={saving}
              className="identifier-editor-modal__icon-input"
              placeholder="●"
            />
          </div>
          <div className="field identifier-editor-modal__color-field">
            <label htmlFor="identifier-color">Color</label>
            <div className="modal-color-row">
              <input
                id="identifier-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={saving}
              />
              <input
                type="text"
                className="modal-color-hex"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
          <div className="identifier-editor-modal__preview" aria-hidden>
            <span className="identifier-editor-modal__preview-icon" style={{ color }}>
              {icon.trim() || '●'}
            </span>
            <span className="identifier-editor-modal__preview-caption">Preview</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="identifier-query">Search rule</label>
          <div className="search-bar__input-wrap identifier-editor-modal__query-wrap">
            <input
              id="identifier-query"
              ref={queryRef}
              type="text"
              value={queryText}
              onChange={(e) => {
                setQueryText(e.target.value)
                setQueryCursor(e.target.selectionStart ?? e.target.value.length)
              }}
              onSelect={(e) => {
                const t = e.target as HTMLInputElement
                setQueryCursor(t.selectionStart ?? t.value.length)
              }}
              onClick={(e) => {
                const t = e.target as HTMLInputElement
                setQueryCursor(t.selectionStart ?? t.value.length)
              }}
              placeholder="e.g. untagged: or tag:hero"
              disabled={saving}
              spellCheck={false}
              autoComplete="off"
            />
            <SearchAutocomplete
              text={queryText}
              cursor={queryCursor}
              tags={tags}
              collections={collections}
              roots={roots}
              onApply={(nextText, nextCursor) => {
                setQueryText(nextText)
                setQueryCursor(nextCursor)
                requestAnimationFrame(() => {
                  queryRef.current?.focus()
                  queryRef.current?.setSelectionRange(nextCursor, nextCursor)
                })
              }}
            />
          </div>
          <p className="field-hint">Uses the same syntax as the gallery search bar.</p>
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
