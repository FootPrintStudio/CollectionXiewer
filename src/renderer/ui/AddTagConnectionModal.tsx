import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Tag, TagConnection } from '../../shared/types'
import { formatTagLabel } from '../../shared/tagDisplay'
import {
  TAG_CONNECTION_KIND_META,
  TAG_CONNECTION_KINDS,
  validateTagConnection,
  type TagConnectionKind
} from '../../shared/tagConnections'
import { tagChipStyle } from '../lib/tagChipStyle'
import { useResolvedTagColor } from '../hooks/useResolvedTagColor'
import { TagChipContent } from '../components/TagChipContent'

export interface AddTagConnectionModalProps {
  sourceTag: Tag
  existing: TagConnection[]
  onClose: () => void
  onAdded: (connection: TagConnection) => void
}

function ConnectionTargetOption({
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

export function AddTagConnectionModal({
  sourceTag,
  existing,
  onClose,
  onAdded
}: AddTagConnectionModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Tag[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [kind, setKind] = useState<TagConnectionKind>('soft')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const excludedIds = new Set([sourceTag.id])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const q = query.trim()
      const matches: Tag[] = q
        ? await window.collectionXiewer.tags.search(q)
        : await window.collectionXiewer.tags.list()
      if (cancelled) return
      const filtered = matches.filter((t: Tag) => {
        if (excludedIds.has(t.id)) return false
        if (existing.some((c) => c.target_tag_id === t.id && c.kind === kind)) return false
        return true
      })
      setResults(filtered.slice(0, 40))
      if (selectedId != null && !filtered.some((t) => t.id === selectedId)) {
        setSelectedId(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [query, sourceTag.id, existing, kind, selectedId])

  const submit = async () => {
    if (selectedId == null) {
      setError('Choose a tag to connect to.')
      return
    }
    const validation = validateTagConnection(sourceTag.id, selectedId, kind, existing)
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    setSaving(true)
    try {
      const connection = await window.collectionXiewer.tags.addConnection(
        sourceTag.id,
        selectedId,
        kind
      )
      onAdded(connection)
      setSelectedId(null)
      setQuery('')
      setError(null)
      searchRef.current?.focus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add connection.')
    } finally {
      setSaving(false)
    }
  }

  const kindMeta = TAG_CONNECTION_KIND_META[kind]

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-dialog modal-dialog--compact tag-connection-modal"
        role="dialog"
        aria-labelledby="tag-connection-modal-title"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <h2 id="tag-connection-modal-title" className="modal-title">
          Connect from {formatTagLabel(sourceTag)}
        </h2>
        <p className="modal-hint">
          Outgoing connections from this tag. Hard links auto-apply on media; soft links appear as
          suggestions.
        </p>

        <div className="tag-connection-kind-toggle" role="group" aria-label="Connection kind">
          {TAG_CONNECTION_KINDS.map((k) => {
            const meta = TAG_CONNECTION_KIND_META[k]
            return (
              <button
                key={k}
                type="button"
                className={kind === k ? 'primary' : ''}
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k)
                  setError(null)
                }}
              >
                {meta.label}
              </button>
            )
          })}
        </div>
        <p className="tag-connection-modal__kind-desc">{kindMeta.description}</p>

        <div className="field">
          <label htmlFor="tag-connection-search">Target tag</label>
          <input
            id="tag-connection-search"
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="Search tags…"
            autoComplete="off"
          />
        </div>

        <div className="tag-connection-picker" role="listbox" aria-label="Target tags">
          {results.length === 0 ? (
            <p className="tag-connection-picker__empty">No matching tags.</p>
          ) : (
            results.map((t) => (
              <ConnectionTargetOption
                key={t.id}
                tag={t}
                selected={selectedId === t.id}
                onSelect={() => {
                  setSelectedId(t.id)
                  setError(null)
                }}
              />
            ))
          )}
        </div>

        {error ? <p className="modal-error">{error}</p> : null}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Done
          </button>
          <button type="button" className="primary" disabled={saving} onClick={() => void submit()}>
            {saving ? 'Adding…' : 'Add connection'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
