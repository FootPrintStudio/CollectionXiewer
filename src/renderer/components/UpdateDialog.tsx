import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { UpdaterStatus } from '../../shared/updaterTypes'
import { GITHUB_RELEASES_URL } from '../../shared/updaterTypes'

interface Props {
  onClose: () => void
}

function statusMessage(status: UpdaterStatus): string {
  switch (status.phase) {
    case 'unavailable':
      return status.message ?? 'Updates are only available in the installed app.'
    case 'checking':
      return 'Checking for updates…'
    case 'available':
      return `Version ${status.version ?? ''} is available (you have ${status.currentVersion}).`
    case 'not-available':
      return `You are on the latest version (${status.currentVersion}).`
    case 'downloading':
      return `Downloading update… ${Math.round(status.percent ?? 0)}%`
    case 'downloaded':
      return `Version ${status.version ?? ''} is ready to install.`
    case 'error':
      return status.message ?? 'Update check failed.'
    default:
      return `Current version: ${status.currentVersion}`
  }
}

export function UpdateDialog({ onClose }: Props) {
  const [status, setStatus] = useState<UpdaterStatus | null>(null)

  const refresh = useCallback(async () => {
    const next = await window.collectionXiewer.updater.getState()
    setStatus(next)
  }, [])

  useEffect(() => {
    void refresh()
    return window.collectionXiewer.updater.onStatus((next) => setStatus(next))
  }, [refresh])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const phase = status?.phase ?? 'idle'
  const busy = phase === 'checking' || phase === 'downloading'

  const onCheck = () => {
    void window.collectionXiewer.updater.check()
  }

  const onDownload = () => {
    void window.collectionXiewer.updater.download()
  }

  const onRestart = () => {
    window.collectionXiewer.updater.quitAndInstall()
  }

  const onOpenReleases = () => {
    void window.collectionXiewer.updater.openReleases()
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-dialog update-dialog"
        role="dialog"
        aria-labelledby="update-dialog-title"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="update-dialog-title" className="modal-title">
          Updates
        </h2>
        <p className="modal-hint update-dialog__message">
          {status ? statusMessage(status) : 'Loading…'}
        </p>
        {phase === 'downloading' ? (
          <progress
            className="update-dialog__progress"
            max={100}
            value={status?.percent ?? 0}
            aria-label="Download progress"
          />
        ) : null}
        {phase === 'downloaded' ? (
          <p className="settings-menu__toggle-hint">
            The app will restart and replace this AppImage. If that fails, download the new AppImage
            from GitHub and replace it manually.
          </p>
        ) : null}
        <div className="modal-actions update-dialog__actions">
          {phase === 'available' ? (
            <button type="button" className="primary" disabled={busy} onClick={onDownload}>
              Download
            </button>
          ) : null}
          {phase === 'downloaded' ? (
            <button type="button" className="primary" onClick={onRestart}>
              Restart to update
            </button>
          ) : null}
          {phase !== 'checking' && phase !== 'downloading' && phase !== 'downloaded' ? (
            <button
              type="button"
              className="primary"
              disabled={busy || phase === 'unavailable'}
              onClick={onCheck}
            >
              Check for updates
            </button>
          ) : null}
          <button type="button" onClick={onOpenReleases} title={GITHUB_RELEASES_URL}>
            GitHub releases
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
