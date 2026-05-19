import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Identifier } from '../../shared/types'
import { useAppStore } from '../store/appStore'
export interface SettingsIdentifiersPanelProps {
  onOpenEditor: (target: Identifier | 'new') => void
}

export function SettingsIdentifiersPanel({ onOpenEditor }: SettingsIdentifiersPanelProps) {
  const bumpIdentifiersRevision = useAppStore((s) => s.bumpIdentifiersRevision)
  const identifiersRevision = useAppStore((s) => s.identifiersRevision)
  const [list, setList] = useState<Identifier[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setList(await window.collectionXiewer.identifiers.list())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, identifiersRevision])

  const toggleEnabled = async (id: number, enabled: boolean) => {
    await window.collectionXiewer.identifiers.setEnabled(id, !enabled)
    void load()
    bumpIdentifiersRevision()
  }

  const remove = async (id: number) => {
    if (!confirm('Delete this identifier?')) return
    await window.collectionXiewer.identifiers.delete(id)
    void load()
    bumpIdentifiersRevision()
  }

  const move = async (id: number, direction: 'up' | 'down') => {
    await window.collectionXiewer.identifiers.move(id, direction)
    void load()
    bumpIdentifiersRevision()
  }

  return (
    <section className="settings-identifiers">
      <div className="settings-identifiers__header">
        <h3 className="settings-identifiers__title">Identifiers</h3>
        <button type="button" className="primary" onClick={() => onOpenEditor('new')}>
          <Plus size={14} aria-hidden /> Add
        </button>
      </div>
      <p className="settings-identifiers__hint">
        Coloured icons on gallery thumbnails when media matches a search rule.
      </p>
      {loading ? <p className="empty-hint">Loading…</p> : null}
      {!loading && list.length === 0 ? (
        <p className="empty-hint">No identifiers yet.</p>
      ) : null}
      <ul className="settings-identifiers__list">
        {list.map((item, index) => (
          <li key={item.id} className="settings-identifiers__row">
            <span
              className="settings-identifiers__icon-preview"
              style={{ color: item.color }}
              title={item.label}
            >
              {item.icon}
            </span>
            <div className="settings-identifiers__meta">
              <span className="settings-identifiers__label">{item.label}</span>
              <code className="settings-identifiers__query">{item.query_text}</code>
            </div>
            <label className="settings-identifiers__enabled">
              <input
                type="checkbox"
                checked={!!item.enabled}
                onChange={() => void toggleEnabled(item.id, !!item.enabled)}
              />
              On
            </label>
            <div className="settings-identifiers__actions">
              <button
                type="button"
                title="Move up"
                disabled={index === 0}
                onClick={() => void move(item.id, 'up')}
              >
                <ChevronUp size={16} aria-hidden />
              </button>
              <button
                type="button"
                title="Move down"
                disabled={index === list.length - 1}
                onClick={() => void move(item.id, 'down')}
              >
                <ChevronDown size={16} aria-hidden />
              </button>
              <button type="button" title="Edit" onClick={() => onOpenEditor(item)}>
                <Pencil size={16} aria-hidden />
              </button>
              <button type="button" className="danger" title="Delete" onClick={() => void remove(item.id)}>
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
