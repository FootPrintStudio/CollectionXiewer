import { useEffect } from 'react'
import { BoardCanvas } from './BoardCanvas'
import { BoardToolbar } from './BoardToolbar'
import { useBoardStore } from '../../store/boardStore'
import { isEditableTarget } from '../../lib/keyboardTargets'

interface DesignBoardViewProps {
  galleryStripOpen?: boolean
  onToggleGalleryStrip?: () => void
}

export function DesignBoardView({
  galleryStripOpen = true,
  onToggleGalleryStrip
}: DesignBoardViewProps = {}) {
  const removeSelected = useBoardStore((s) => s.removeSelected)
  const clearSelection = useBoardStore((s) => s.clearSelection)
  const duplicateSelected = useBoardStore((s) => s.duplicateSelected)
  const activeFile = useBoardStore((s) => s.activeFile)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeSelected()
      }
      if (e.key === 'Escape') {
        clearSelection()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        duplicateSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [removeSelected, clearSelection, duplicateSelected])

  if (!activeFile) {
    return (
      <div className="board-empty">
        <p>Select a board from the Boards library, or create a new one.</p>
      </div>
    )
  }

  return (
    <div className="design-board-view">
      <BoardToolbar
        galleryStripOpen={galleryStripOpen}
        onToggleGalleryStrip={onToggleGalleryStrip}
      />
      <BoardCanvas />
    </div>
  )
}
