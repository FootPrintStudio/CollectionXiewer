import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Tag } from '../../shared/types'
import { isUniversalSubjectLabel } from '../../shared/subjects'
import { tagChipStyle } from '../lib/tagChipStyle'
import { useResolvedTagColor } from '../hooks/useResolvedTagColor'
import { TagChipContent } from './TagChipContent'
import { bulkApplyTagToSelection } from '../lib/bulkApplyTag'

function TagOption({
  tag,
  selected,
  onSelect
}: {
  tag: Tag
  selected: boolean
  onSelect: () => void
}) {
  const color = useResolvedTagColor(tag)
  return (
    <button
      type="button"
      className={`tag-connection-picker__option${selected ? ' tag-connection-picker__option--selected' : ''}`}
      onClick={onSelect}
    >
      <span className="chip tag-connection-picker__chip" style={tagChipStyle(color)}>
        <TagChipContent tag={tag} />
      </span>
    </button>
  )
}

export interface BulkApplyTagModalProps {
  mediaIds: number[]
  subjectLabelHints: string[]
  onClose: () => void
  onDone: (result: { applied: number; skipped: number }) => void
}

export function BulkApplyTagModal({
  mediaIds,
  subjectLabelHints,
  onClose,
  onDone
}: BulkApplyTagModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Tag[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [subjectMode, setSubjectMode] = useState<'universal' | 'label'>('universal')
  const [subjectLabel, setSubjectLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const q = query.trim()
      const matches: Tag[] = q
        ? await window.collectionXiewer.tags.search(q)
        : await window.collectionXiewer.tags.list()
      if (cancelled) return
      setResults(matches.slice(0, 40))
      if (selectedId != null && !matches.some((t) => t.id === selectedId)) {
        setSelectedId(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [query, selectedId])

  const submit = async () => {
    if (selectedId == null) {
      setError('Choose a tag to apply.')
      return
    }
    if (subjectMode === 'label') {
      const trimmed = subjectLabel.trim()
      if (!trimmed) {
        setError('Enter a subject label.')
        return
      }
      if (isUniversalSubjectLabel(trimmed)) {
        setError('Use Universal mode for the Universal subject.')
        return
      }
    }
    setError(null)
    setSaving(true)
    try {
      const subject =
        subjectMode === 'universal'
          ? ({ mode: 'universal' } as const)
          : ({ mode: 'label', label: subjectLabel.trim() } as const)
      const result = await bulkApplyTagToSelection(mediaIds, selectedId, subject)
      onDone(result)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply tag.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={saving ? undefined : onClose} role="presentation">
      <div
        className="modal-dialog bulk-apply-tag-modal"
        role="dialog"
        aria-labelledby="bulk-apply-tag-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="bulk-apply-tag-title" className="modal-title">
          Apply tag to {mediaIds.length} items
        </h2>
        <label htmlFor="bulk-apply-tag-search">Tag</label>
        <input
          id="bulk-apply-tag-search"
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tags…"
          disabled={saving}
        />
        <div className="tag-connection-picker__list">
          {results.map((tag) => (
            <TagOption
              key={tag.id}
              tag={tag}
              selected={selectedId === tag.id}
              onSelect={() => setSelectedId(tag.id)}
            />
          ))}
        </div>
        <fieldset className="bulk-apply-tag-modal__subject">
          <legend>Subject</legend>
          <label>
            <input
              type="radio"
              name="bulk-subject-mode"
              checked={subjectMode === 'universal'}
              onChange={() => setSubjectMode('universal')}
              disabled={saving}
            />
            Universal
          </label>
          <label>
            <input
              type="radio"
              name="bulk-subject-mode"
              checked={subjectMode === 'label'}
              onChange={() => setSubjectMode('label')}
              disabled={saving}
            />
            Named subject
          </label>
          {subjectMode === 'label' ? (
            <input
              type="text"
              list="bulk-subject-labels"
              value={subjectLabel}
              onChange={(e) => setSubjectLabel(e.target.value)}
              placeholder="Subject label"
              disabled={saving}
            />
          ) : null}
          <datalist id="bulk-subject-labels">
            {subjectLabelHints.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        </fieldset>
        {error ? <p className="modal-error">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
