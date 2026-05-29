import { useMemo, useState } from 'react'
import type { Tag, TagConnection } from '../../shared/types'
import { TAG_CONNECTION_KIND_META, type TagConnectionKind } from '../../shared/tagConnections'
import { formatTagLabel } from '../../shared/tagDisplay'
import { tagChipStyle } from '../lib/tagChipStyle'
import { useResolvedTagColor } from '../hooks/useResolvedTagColor'
import { TagChipContent } from './TagChipContent'
import { AddTagConnectionModal } from '../ui/AddTagConnectionModal'
import { SectionHelp } from '../ui/SectionHelp'

function ConnectionTargetChip({
  tag,
  onSelect
}: {
  tag: Tag
  onSelect: () => void
}) {
  const color = useResolvedTagColor(tag)
  return (
    <button type="button" className="tag-connection-row__target" onClick={onSelect}>
      <span className="chip tag-connection-row__chip" style={tagChipStyle(color)}>
        <TagChipContent tag={tag} />
      </span>
    </button>
  )
}

function ConnectionRow({
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
  return (
    <li className={`tag-connection-row tag-connection-row--${connection.kind}`}>
      <span className={`tag-connection-row__badge tag-connection-row__badge--${connection.kind}`}>
        {meta.badge}
      </span>
      {target ? (
        <ConnectionTargetChip tag={target} onSelect={onSelectTarget} />
      ) : (
        <button type="button" className="tag-connection-row__missing" onClick={onSelectTarget}>
          Tag #{connection.target_tag_id} (missing)
        </button>
      )}
      <button
        type="button"
        className="tag-connection-row__remove"
        aria-label={`Remove ${meta.label}`}
        onClick={onRemove}
      >
        ×
      </button>
    </li>
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
                {TAG_CONNECTION_KIND_META[kind].label}
                <span className="tag-connections-section__count">{byKind[kind].length}</span>
              </h3>
              <ul className="tag-connections-section__list">
                {byKind[kind].map((c) => (
                  <ConnectionRow
                    key={c.id}
                    connection={c}
                    target={tagsById.get(c.target_tag_id)}
                    onSelectTarget={() => onSelectTag(c.target_tag_id)}
                    onRemove={() => void remove(c.id)}
                  />
                ))}
              </ul>
            </div>
          )
        )
      )}

      {showAddModal ? (
        <AddTagConnectionModal
          sourceTag={sourceTag}
          existing={connections}
          onClose={() => setShowAddModal(false)}
          onAdded={(connection) => onConnectionsChange([...connections, connection])}
        />
      ) : null}
    </section>
  )
}
