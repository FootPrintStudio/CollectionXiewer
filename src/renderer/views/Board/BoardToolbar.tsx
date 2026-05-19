import { useState } from 'react'
import { BOARD_ALIGN_OPTIONS, type BoardAlignMode } from '../../lib/boardLayout'
import { useBoardStore } from '../../store/boardStore'
import { useAppStore } from '../../store/appStore'

interface BoardToolbarProps {
  galleryStripOpen?: boolean
  onToggleGalleryStrip?: () => void
}

export function BoardToolbar({
  galleryStripOpen = true,
  onToggleGalleryStrip
}: BoardToolbarProps = {}) {
  const document = useBoardStore((s) => s.document)
  const activeFile = useBoardStore((s) => s.activeFile)
  const tool = useBoardStore((s) => s.tool)
  const selection = useBoardStore((s) => s.selection)
  const selectionAnchorId = useBoardStore((s) => s.selectionAnchorId)
  const saving = useBoardStore((s) => s.saving)
  const dirty = useBoardStore((s) => s.dirty)
  const setTool = useBoardStore((s) => s.setTool)
  const setMainView = useAppStore((s) => s.setMainView)
  const duplicateSelected = useBoardStore((s) => s.duplicateSelected)
  const removeSelected = useBoardStore((s) => s.removeSelected)
  const bringForward = useBoardStore((s) => s.bringForward)
  const sendBackward = useBoardStore((s) => s.sendBackward)
  const alignSelected = useBoardStore((s) => s.alignSelected)
  const normalizeSelectedByWidth = useBoardStore((s) => s.normalizeSelectedByWidth)
  const normalizeSelectedByHeight = useBoardStore((s) => s.normalizeSelectedByHeight)
  const distributeSelected = useBoardStore((s) => s.distributeSelected)
  const createGroupFromSelection = useBoardStore((s) => s.createGroupFromSelection)
  const ungroupSelection = useBoardStore((s) => s.ungroupSelection)
  const undo = useBoardStore((s) => s.undo)
  const undoStack = useBoardStore((s) => s.undoStack)
  const focusAllItems = useBoardStore((s) => s.focusAllItems)
  const updateItem = useBoardStore((s) => s.updateItem)
  const addMediaItems = useBoardStore((s) => s.addMediaItems)
  const selectedMediaIds = useAppStore((s) => s.selectedMediaIds)
  const selectedItems = document?.items.filter((i) => selection.includes(i.id)) ?? []
  const single = selectedItems.length === 1 ? selectedItems[0] : null
  const hasSelection = selection.length > 0
  const singleMedia = single?.kind === 'media' ? single : null
  const selectedMediaCount = selectedItems.filter((i) => i.kind === 'media').length
  const anchorItem =
    selectedItems.find((i) => i.id === (selectionAnchorId ?? selection[0])) ?? null
  const canNormalize = selectedMediaCount >= 2 && anchorItem?.kind === 'media'
  const canUngroup = selectedItems.some((i) => i.groupId != null)
  const canUndo = undoStack.length > 0
  const canFocus = (document?.items.length ?? 0) > 0
  const [alignChoice, setAlignChoice] = useState('')
  const [layerChoice, setLayerChoice] = useState('')
  const [sizeChoice, setSizeChoice] = useState('')

  const onAlignChange = (value: string) => {
    if (!value) return
    alignSelected(value as BoardAlignMode)
    setAlignChoice('')
  }

  const onLayerChange = (value: string) => {
    if (value === 'forward') bringForward()
    else if (value === 'backward') sendBackward()
    setLayerChoice('')
  }

  const onSizeChange = (value: string) => {
    if (value === 'width') normalizeSelectedByWidth()
    else if (value === 'height') normalizeSelectedByHeight()
    setSizeChoice('')
  }

  const closeBoard = () => {
    void useBoardStore.getState().saveNow()
    useBoardStore.getState().closeBoard()
    setMainView('gallery')
  }

  const exportPng = async () => {
    if (!activeFile) return
    await window.collectionXiewer.boards.exportPng(activeFile)
  }

  const patchSelectedMedia = (patch: Record<string, unknown>) => {
    for (const id of selection) {
      updateItem(id, patch)
    }
  }

  const addSelectedFromGallery = () => {
    if (selectedMediaIds.length === 0) return
    const cam = document?.camera ?? { x: 0, y: 0, scale: 1 }
    addMediaItems(selectedMediaIds, {
      x: (400 - cam.x) / cam.scale,
      y: (300 - cam.y) / cam.scale
    })
  }

  return (
    <header className="board-toolbar" aria-label="Board tools">
      <div className="board-toolbar__row board-toolbar__row--primary">
        <button type="button" onClick={closeBoard}>
          ← Gallery only
        </button>
        {onToggleGalleryStrip && (
          <button type="button" onClick={onToggleGalleryStrip}>
            {galleryStripOpen ? 'Hide refs' : 'Show refs'}
          </button>
        )}
        <button
          type="button"
          className="primary"
          disabled={selectedMediaIds.length === 0}
          onClick={addSelectedFromGallery}
        >
          Add selected{selectedMediaIds.length > 0 ? ` (${selectedMediaIds.length})` : ''}
        </button>
        <span className="board-toolbar__title">{document?.name ?? 'Board'}</span>
        <span className="board-toolbar__status">
          {saving ? 'Saving…' : dirty ? 'Unsaved' : 'Saved'}
        </span>
        <span className="board-toolbar__spacer" aria-hidden />
        <div className="board-toolbar__tools" role="group" aria-label="Canvas tools">
          <button
            type="button"
            className={tool === 'select' ? 'primary' : ''}
            onClick={() => setTool('select')}
          >
            Select
          </button>
          <button
            type="button"
            className={tool === 'pan' ? 'primary' : ''}
            onClick={() => setTool('pan')}
            title="Pan (or hold Space)"
          >
            Pan
          </button>
          <button
            type="button"
            className={tool === 'note' ? 'primary' : ''}
            onClick={() => setTool('note')}
            title="Click canvas to place a note"
          >
            Note
          </button>
          <button
            type="button"
            disabled={!canUndo}
            title="Undo last change (up to 5 steps, Ctrl+Z)"
            onClick={() => undo()}
          >
            Undo
          </button>
          <button
            type="button"
            disabled={!canFocus}
            title="Fit all items in view"
            onClick={() => focusAllItems()}
          >
            Focus
          </button>
        </div>
        <button type="button" onClick={() => void exportPng()}>
          Export PNG
        </button>
      </div>

      <div className="board-toolbar__row board-toolbar__row--selection" role="group" aria-label="Selection">
        <button type="button" disabled={!hasSelection} onClick={() => duplicateSelected()}>
          Duplicate
        </button>
        <button type="button" disabled={!hasSelection} onClick={() => removeSelected()}>
          Delete
        </button>
        <label className="board-toolbar__field">
          <span className="board-toolbar__field-label">Layer</span>
          <select
            className="toolbar-select board-toolbar__select"
            value={layerChoice}
            disabled={!hasSelection}
            aria-label="Layer order"
            onChange={(e) => onLayerChange(e.target.value)}
          >
            <option value="">Order…</option>
            <option value="forward">Bring forward</option>
            <option value="backward">Send backward</option>
          </select>
        </label>
        <label className="board-toolbar__field">
          <span className="board-toolbar__field-label">Size</span>
          <select
            className="toolbar-select board-toolbar__select"
            value={sizeChoice}
            disabled={!canNormalize}
            aria-label="Match size to first selected"
            onChange={(e) => onSizeChange(e.target.value)}
          >
            <option value="">Match…</option>
            <option value="width">Match width</option>
            <option value="height">Match height</option>
          </select>
        </label>
        <label className="board-toolbar__field">
          <span className="board-toolbar__field-label">Align</span>
          <select
            className="toolbar-select board-toolbar__select"
            value={alignChoice}
            disabled={!hasSelection}
            aria-label="Align selection"
            onChange={(e) => onAlignChange(e.target.value)}
          >
            <option value="">Choose alignment…</option>
            {BOARD_ALIGN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={selection.length < 3}
          onClick={() => distributeSelected('horizontal')}
        >
          Dist H
        </button>
        <button
          type="button"
          disabled={selection.length < 3}
          onClick={() => distributeSelected('vertical')}
        >
          Dist V
        </button>
        <button
          type="button"
          disabled={!hasSelection}
          onClick={() => createGroupFromSelection(`Group ${(document?.groups.length ?? 0) + 1}`)}
        >
          Group
        </button>
        <button
          type="button"
          disabled={!canUngroup}
          title="Remove selected items from their group"
          onClick={() => ungroupSelection()}
        >
          Ungroup
        </button>
        <button
          type="button"
          disabled={!single}
          onClick={() => single && updateItem(single.id, { locked: !single.locked })}
        >
          {single?.locked ? 'Unlock' : 'Lock'}
        </button>
        <button
          type="button"
          disabled={!singleMedia}
          onClick={() => singleMedia && patchSelectedMedia({ flipX: !singleMedia.flipX })}
        >
          Flip H
        </button>
        <button
          type="button"
          disabled={!singleMedia}
          onClick={() => singleMedia && patchSelectedMedia({ flipY: !singleMedia.flipY })}
        >
          Flip V
        </button>
        <label className="board-toolbar__opacity">
          Opacity
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            disabled={!singleMedia}
            value={singleMedia?.opacity ?? 1}
            onChange={(e) =>
              singleMedia && updateItem(singleMedia.id, { opacity: Number(e.target.value) })
            }
          />
        </label>
      </div>
    </header>
  )
}
