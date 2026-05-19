import { useEffect, useRef, useState } from 'react'
import { Settings } from 'lucide-react'
import type { Identifier } from '../../shared/types'
import { isIdentifierEditorLayerNode } from '../lib/modalLayer'
import { useAppStore } from '../store/appStore'
import { SettingsIdentifiersPanel } from './SettingsIdentifiersPanel'
import { IdentifierEditorModal } from './IdentifierEditorModal'

export function SettingsMenu() {
  const showThumbTagList = useAppStore((s) => s.showThumbTagList)
  const showIdentifiers = useAppStore((s) => s.showIdentifiers)
  const setShowThumbTagList = useAppStore((s) => s.setShowThumbTagList)
  const setShowIdentifiers = useAppStore((s) => s.setShowIdentifiers)
  const bumpIdentifiersRevision = useAppStore((s) => s.bumpIdentifiersRevision)
  const [open, setOpen] = useState(false)
  const [identifierEdit, setIdentifierEdit] = useState<Identifier | null | 'new' | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (identifierEdit != null) return
      if (isIdentifierEditorLayerNode(e.target as Node)) return
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (identifierEdit != null || isIdentifierEditorLayerNode(document.activeElement)) return
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, identifierEdit])

  const onIdentifierSaved = () => {
    bumpIdentifiersRevision()
    setIdentifierEdit(null)
  }

  return (
    <>
      <div className="settings-menu" ref={panelRef}>
        <button
          type="button"
          className={`settings-menu__trigger${open ? ' settings-menu__trigger--open' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Settings"
        >
          <Settings size={18} aria-hidden />
          Settings
        </button>
        {open ? (
          <div className="settings-menu__panel" role="dialog" aria-label="Settings">
            <h2 className="settings-menu__panel-title">Display</h2>
            <label className="settings-menu__toggle">
              <input
                type="checkbox"
                checked={showThumbTagList}
                onChange={(e) => setShowThumbTagList(e.target.checked)}
              />
              Thumbnail tag list
            </label>
            <p className="settings-menu__toggle-hint">
              Bottom strip on thumbs; hover to scroll all applied tags.
            </p>
            <label className="settings-menu__toggle">
              <input
                type="checkbox"
                checked={showIdentifiers}
                onChange={(e) => setShowIdentifiers(e.target.checked)}
              />
              Identifier icons
            </label>
            <p className="settings-menu__toggle-hint">
              Coloured icons on matching gallery thumbnails (top-left).
            </p>
            <SettingsIdentifiersPanel onOpenEditor={setIdentifierEdit} />
          </div>
        ) : null}
      </div>
      {identifierEdit != null ? (
        <IdentifierEditorModal
          identifier={identifierEdit === 'new' ? null : identifierEdit}
          onClose={() => setIdentifierEdit(null)}
          onSaved={onIdentifierSaved}
        />
      ) : null}
    </>
  )
}
