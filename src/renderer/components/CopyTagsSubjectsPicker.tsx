import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { MediaVariantRef } from '../../shared/types'
import { basenameFromRelativePath } from '../lib/mediaDisplay'

export type CopySourceChoice =
  | { kind: 'mediaId'; id: number; label: string }
  | { kind: 'selection' }
  | { kind: 'file' }

interface Props {
  variants: MediaVariantRef[]
  otherSelectedCount: number
  onChoose: (choice: CopySourceChoice) => void
  onCancel: () => void
}

export function CopyTagsSubjectsPicker({
  variants,
  otherSelectedCount,
  onChoose,
  onCancel
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const variantChoices = useMemo(
    () =>
      variants.map((v) => ({
        id: v.id,
        label: basenameFromRelativePath(v.relative_path)
      })),
    [variants]
  )

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        ref={panelRef}
        className="modal-dialog copy-tags-picker"
        role="dialog"
        aria-labelledby="copy-tags-picker-title"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="copy-tags-picker-title" className="modal-title">
          Copy Tags and Subjects
        </h2>
        <p className="copy-tags-picker__hint">
          Choose a source media item. Matching subject names are created if missing; tags are merged
          (existing tags stay).
        </p>

        {variantChoices.length > 0 ? (
          <div className="copy-tags-picker__group">
            <p className="copy-tags-picker__group-title">From a variant</p>
            <div className="copy-tags-picker__list">
              {variantChoices.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="copy-tags-picker__item"
                  onClick={() => onChoose({ kind: 'mediaId', id: v.id, label: v.label })}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="copy-tags-picker__group">
          <p className="copy-tags-picker__group-title">Other sources</p>
          <div className="copy-tags-picker__list">
            <button
              type="button"
              className="copy-tags-picker__item"
              disabled={otherSelectedCount !== 1}
              title={
                otherSelectedCount === 1
                  ? 'Use the other selected gallery item'
                  : 'Select exactly one other gallery item (Ctrl/Cmd-click)'
              }
              onClick={() => onChoose({ kind: 'selection' })}
            >
              From selection
              {otherSelectedCount === 1 ? '' : ` (need 1 other selected)`}
            </button>
            <button
              type="button"
              className="copy-tags-picker__item"
              onClick={() => onChoose({ kind: 'file' })}
            >
              Choose file…
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
