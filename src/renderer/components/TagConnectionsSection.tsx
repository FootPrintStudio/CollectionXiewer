import { useMemo, useState } from 'react'
import type { Tag, TagConnection } from '../../shared/types'
import { TAG_CONNECTION_KIND_META, type TagConnectionKind } from '../../shared/tagConnections'
import { formatTagLabel } from '../../shared/tagDisplay'
import { tagChipStyle } from '../lib/tagChipStyle'
import { useResolvedTagColor } from '../hooks/useResolvedTagColor'
import { TagChipContent } from './TagChipContent'
import { AddTagConnectionModal } from '../ui/AddTagConnectionModal'
import { SectionHelp } from '../ui/SectionHelp'
import { useAppStore } from '../store/appStore'

function ConnectionChip({
  connection,
  target,
  onSelectTarget,
  onRemove
}: {
  connection: TagConnection
  target: Tag | undefined
  onSelectTarget: () => void
  onRemove: () => void
}) {
  const meta = TAG_CONNECTION_KIND_META[connection.kind]
  const color = useResolvedTagColor(target ?? null)

  if (!target) {
    return (
      <span className={`chip chip--removable tag-connection-chip tag-connection-chip--missing tag-connection-chip--${connection.kind}`}>
        <button type="button" className="tag-connection-chip__target" onClick={onSelectTarget}>
          Tag #{connection.target_tag_id} (missing)
        </button>
        <button
          type="button"
          className="chip__remove"
          aria-label={`Remove ${meta.label} connection`}
          onClick={onRemove}
        >
          ×
        </button>
      </span>
    )
  }

  return (
    <span
      className={`chip chip--removable tag-connection-chip tag-connection-chip--${connection.kind}`}
      style={tagChipStyle(color)}
    >
      <button type="button" className="tag-connection-chip__target" onClick={onSelectTarget}>
        <TagChipContent tag={target} />
      </button>
      <button
        type="button"
        className="chip__remove"
        aria-label={`Remove ${meta.label} connection to ${formatTagLabel(target)}`}
        onClick={onRemove}
      >
        ×
      </button>
    </span>
  )
}

interface Props {
  sourceTag: Tag
  connections: TagConnection[]
  tagsById: Map<number, Tag>
  onSelectTag: (tagId: number) => void
  onConnectionsChange: (next: TagConnection[]) => void
}

export function TagConnectionsSection({
  sourceTag,
  connections,
  tagsById,
  onSelectTag,
  onConnectionsChange
}: Props) {
  const [showAddModal, setShowAddModal] = useState(false)
  const bumpTagConnectionsRevision = useAppStore((s) => s.bumpTagConnectionsRevision)

  const byKind = useMemo(() => {
    const groups: Record<TagConnectionKind, TagConnection[]> = { hard: [], soft: [] }
    for (const c of connections) {
      groups[c.kind].push(c)
    }
    for (const kind of Object.keys(groups) as TagConnectionKind[]) {
      groups[kind].sort((a, b) => {
        const la = tagsById.get(a.target_tag_id)
        const lb = tagsById.get(b.target_tag_id)
        const nameA = la ? formatTagLabel(la) : `#${a.target_tag_id}`
        const nameB = lb ? formatTagLabel(lb) : `#${b.target_tag_id}`
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
      })
    }
    return groups
  }, [connections, tagsById])

  const remove = async (id: number) => {
    await window.collectionXiewer.tags.removeConnection(id)
    onConnectionsChange(connections.filter((c) => c.id !== id))
    bumpTagConnectionsRevision()
  }

  return (
    <section className="tag-connections-section" aria-label="Tag connections">
      <div className="tag-connections-section__header">
        <p className="panel-title">
          Connections
          <SectionHelp label="Connections help">
            Outgoing links from this tag. <strong>Hard</strong> tags auto-apply on media;{' '}
            <strong>soft</strong> tags show as suggestions.
          </SectionHelp>
        </p>
        <button type="button" className="primary tag-connections-section__add" onClick={() => setShowAddModal(true)}>
          + Connection
        </button>
      </div>

      {connections.length === 0 ? (
        <p className="tag-connections-section__empty">No connections yet.</p>
      ) : (
        (['hard', 'soft'] as const).map((kind) =>
          byKind[kind].length === 0 ? null : (
            <div key={kind} className="tag-connections-section__group">
              <h3 className="tag-connections-section__group-title">
                {TAG_CONNECTION_KIND_META[kind].sectionLabel}
                <sup className="tag-connections-section__count" aria-label={`${byKind[kind].length}`}>
                  {byKind[kind].length}
                </sup>
              </h3>
              <div className="tag-connections-section__chips" role="list">
                {byKind[kind].map((c) => (
                  <div key={c.id} role="listitem">
                    <ConnectionChip
                      connection={c}
                      target={tagsById.get(c.target_tag_id)}
                      onSelectTarget={() => onSelectTag(c.target_tag_id)}
                      onRemove={() => void remove(c.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        )
      )}

      {showAddModal ? (
        <AddTagConnectionModal
          sourceTag={sourceTag}
          existing={connections}
          onClose={() => setShowAddModal(false)}
          onAdded={(connection) => {
            onConnectionsChange([...connections, connection])
            bumpTagConnectionsRevision()
          }}
        />
      ) : null}
    </section>
  )
}
