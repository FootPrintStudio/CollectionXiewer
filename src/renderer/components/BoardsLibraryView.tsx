import { useEffect, useState } from 'react'
import { LayoutGrid, FolderOpen } from 'lucide-react'
import { useBoardStore } from '../store/boardStore'
import { useAppStore } from '../store/appStore'
import { NewBoardModal } from '../ui/NewBoardModal'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu'

export function BoardsLibraryView() {
  const boardsRoot = useBoardStore((s) => s.boardsRoot)
  const summaries = useBoardStore((s) => s.summaries)
  const activeFile = useBoardStore((s) => s.activeFile)
  const refreshSummaries = useBoardStore((s) => s.refreshSummaries)
  const setBoardsRoot = useBoardStore((s) => s.setBoardsRoot)
  const loadBoard = useBoardStore((s) => s.loadBoard)
  const setMainView = useAppStore((s) => s.setMainView)

  const [showNew, setShowNew] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; fileName: string; name: string } | null>(
    null
  )
  const [renameTarget, setRenameTarget] = useState<{ fileName: string; name: string } | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    void refreshSummaries()
  }, [refreshSummaries])

  const pickRoot = async () => {
    const path = await window.collectionXiewer.boards.pickRoot()
    if (path) await setBoardsRoot(path)
  }

  const openBoard = async (fileName: string) => {
    await loadBoard(fileName)
    setMainView('board')
  }

  const onCreated = async (fileName: string) => {
    await refreshSummaries()
    await openBoard(fileName)
  }

  const doDelete = async () => {
    if (!confirmDelete) return
    await window.collectionXiewer.boards.delete(confirmDelete)
    if (activeFile === confirmDelete) {
      useBoardStore.getState().closeBoard()
      setMainView('gallery')
    }
    setConfirmDelete(null)
    await refreshSummaries()
  }

  const submitRename = async () => {
    if (!renameTarget) return
    await window.collectionXiewer.boards.rename(renameTarget.fileName, renameValue.trim())
    setRenameTarget(null)
    await refreshSummaries()
    if (activeFile === renameTarget.fileName) {
      await loadBoard(renameTarget.fileName)
    }
  }

  const menuItems: ContextMenuItem[] = menu
    ? [
        {
          label: 'Open',
          onClick: () => void openBoard(menu.fileName)
        },
        {
          label: 'Rename',
          onClick: () => {
            setRenameTarget({ fileName: menu.fileName, name: menu.name })
            setRenameValue(menu.name)
          }
        },
        {
          label: 'Delete',
          danger: true,
          onClick: () => setConfirmDelete(menu.fileName)
        }
      ]
    : []

  if (!boardsRoot) {
    return (
      <div className="boards-library boards-library--setup">
        <p className="boards-library__hint">
          Choose a folder where design boards (<code>.cxboard.json</code>) will be stored. You can
          sync or back up this folder manually.
        </p>
        <button type="button" className="primary" style={{ width: '100%' }} onClick={() => void pickRoot()}>
          <FolderOpen size={14} aria-hidden /> Choose boards folder
        </button>
      </div>
    )
  }

  return (
    <div className="boards-library">
      <div className="boards-library__header">
        <button type="button" className="boards-library__root-btn" onClick={() => void pickRoot()} title={boardsRoot}>
          Change folder
        </button>
        <button type="button" className="primary" onClick={() => setShowNew(true)}>
          + New board
        </button>
      </div>
      <p className="boards-library__path" title={boardsRoot}>
        {boardsRoot}
      </p>
      <ul className="boards-library__list">
        {summaries.map((b) => (
          <li key={b.fileName}>
            <button
              type="button"
              className={`list-item boards-library__item${activeFile === b.fileName ? ' active' : ''}`}
              onClick={() => void openBoard(b.fileName)}
              onContextMenu={(e) => {
                e.preventDefault()
                setMenu({ x: e.clientX, y: e.clientY, fileName: b.fileName, name: b.name })
              }}
            >
              <LayoutGrid size={14} className="boards-library__icon" aria-hidden />
              <span className="boards-library__label">{b.name}</span>
            </button>
          </li>
        ))}
        {summaries.length === 0 && (
          <li className="boards-library__empty">No boards yet — create one above.</li>
        )}
      </ul>

      {showNew && <NewBoardModal onClose={() => setShowNew(false)} onCreated={(f) => void onCreated(f)} />}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete board?"
          message="This removes the board file from your boards folder. This cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={() => void doDelete()}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}
      {renameTarget && (
        <div className="modal-backdrop" role="presentation" onClick={() => setRenameTarget(null)}>
          <div
            className="modal-dialog"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title">Rename board</h2>
            <div className="field">
              <label htmlFor="rename-board">Name</label>
              <input
                id="rename-board"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submitRename()}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setRenameTarget(null)}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={() => void submitRename()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
