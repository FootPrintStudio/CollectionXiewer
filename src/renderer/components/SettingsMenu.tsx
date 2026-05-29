import { useEffect, useRef, useState } from 'react'
import { Settings } from 'lucide-react'
import type { Identifier } from '../../shared/types'
import { isIdentifierEditorLayerNode } from '../lib/modalLayer'
import { useAppStore } from '../store/appStore'
import { SettingsIdentifiersPanel } from './SettingsIdentifiersPanel'
import { IdentifierEditorModal } from './IdentifierEditorModal'
import { UpdateDialog } from './UpdateDialog'
import { showToast } from '../store/toastStore'

export function SettingsMenu() {
  const showThumbTagList = useAppStore((s) => s.showThumbTagList)
  const showIdentifiers = useAppStore((s) => s.showIdentifiers)
  const setShowThumbTagList = useAppStore((s) => s.setShowThumbTagList)
  const setShowIdentifiers = useAppStore((s) => s.setShowIdentifiers)
  const bumpIdentifiersRevision = useAppStore((s) => s.bumpIdentifiersRevision)
  const [open, setOpen] = useState(false)
  const [identifierEdit, setIdentifierEdit] = useState<Identifier | null | 'new' | null>(null)
  const [videoToolsOk, setVideoToolsOk] = useState<boolean | null>(null)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [updatePending, setUpdatePending] = useState(false)
  const [backupBusy, setBackupBusy] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.collectionXiewer.updater.getState().then((s) => {
      if (s.phase === 'available' || s.phase === 'downloaded') setUpdatePending(true)
    })
    return window.collectionXiewer.updater.onStatus((s) => {
      if (s.phase === 'available' || s.phase === 'downloaded') setUpdatePending(true)
    })
  }, [])

  useEffect(() => {
    if (!open) return
    void window.collectionXiewer.video.toolsAvailable().then(setVideoToolsOk)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (identifierEdit != null || updateOpen) return
      if (isIdentifierEditorLayerNode(e.target as Node)) return
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (
          identifierEdit != null ||
          updateOpen ||
          isIdentifierEditorLayerNode(document.activeElement)
        )
          return
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, identifierEdit, updateOpen])

  const onIdentifierSaved = () => {
    bumpIdentifiersRevision()
    setIdentifierEdit(null)
  }

  const openIdentifierEditor = (target: Identifier | 'new') => {
    setOpen(false)
    setIdentifierEdit(target)
  }

  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    if (identifierEdit != null) {
      root.setAttribute('inert', '')
    } else {
      root.removeAttribute('inert')
    }
    return () => root.removeAttribute('inert')
  }, [identifierEdit])

  return (
    <>
      <div className="settings-menu" ref={panelRef}>
        <button
          type="button"
          className={`settings-menu__trigger${open ? ' settings-menu__trigger--open' : ''}${updatePending ? ' settings-menu__trigger--update' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          title={updatePending ? 'Settings — update available' : 'Settings'}
        >
          <Settings size={18} aria-hidden />
          Settings
        </button>
        {open ? (
          <div className="settings-menu__panel" role="dialog" aria-label="Settings">
            <h2 className="settings-menu__panel-title">Updates</h2>
            <button
              type="button"
              className="settings-menu__link-btn"
              onClick={() => {
                setOpen(false)
                setUpdateOpen(true)
                setUpdatePending(false)
              }}
            >
              Check for updates…
              {updatePending ? ' (available)' : ''}
            </button>
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
            {videoToolsOk === false ? (
              <p className="settings-menu__warning" role="status">
                ffmpeg/ffprobe not found on PATH — video thumbnails and metadata need ffmpeg. Set
                FFMPEG_PATH / FFPROBE_PATH to override.
              </p>
            ) : null}
            <SettingsIdentifiersPanel onOpenEditor={openIdentifierEditor} />
            <h2 className="settings-menu__panel-title">Data</h2>
            <button
              type="button"
              className="settings-menu__link-btn"
              disabled={backupBusy}
              onClick={() => {
                void (async () => {
                  setBackupBusy(true)
                  try {
                    const path = await window.collectionXiewer.db.backup()
                    if (path) showToast(`Library backed up to ${path}`, 'success')
                  } finally {
                    setBackupBusy(false)
                  }
                })()
              }}
            >
              {backupBusy ? 'Backing up…' : 'Backup library now…'}
            </button>
            <button
              type="button"
              className="settings-menu__link-btn"
              onClick={() => void window.collectionXiewer.db.openDataFolder()}
            >
              Open data folder
            </button>
            <p className="settings-menu__toggle-hint">
              SQLite database: ~/.config/CollectionXiewer/library.db
            </p>
          </div>
        ) : null}
      </div>
      {updateOpen ? <UpdateDialog onClose={() => setUpdateOpen(false)} /> : null}
      {identifierEdit != null ? (
        <IdentifierEditorModal
          key={identifierEdit === 'new' ? 'new' : identifierEdit.id}
          identifier={identifierEdit === 'new' ? null : identifierEdit}
          onClose={() => setIdentifierEdit(null)}
          onSaved={onIdentifierSaved}
        />
      ) : null}
    </>
  )
}
