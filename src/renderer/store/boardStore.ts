import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { BoardCamera, BoardDocument, BoardItem, BoardMediaItem, BoardNoteItem } from '../../shared/boardSchema'
import { alignItems, cameraToFitBounds, distributeItems, unionRect } from '../lib/boardLayout'
import { captureUndoSnapshot, pushUndoStack, type BoardUndoSnapshot } from '../lib/boardHistory'
import { moveSelectionInStack } from '../lib/boardZOrder'
import { normalizeMediaToHeight, normalizeMediaToWidth } from '../lib/boardItemTransforms'
import { mediaAspectRatio } from '../../shared/mediaDimensions'
import { showError } from './toastStore'

const api = () => window.collectionXiewer.boards

let saveTimer: ReturnType<typeof setTimeout> | null = null
let undoRestoreActive = false

export type BoardTool = 'select' | 'pan' | 'note'

interface BoardState {
  boardsRoot: string | null
  summaries: { fileName: string; name: string; updatedAt: string }[]
  activeFile: string | null
  document: BoardDocument | null
  selection: string[]
  /** First-selected item; kept when extending with Shift/Ctrl (align / normalize reference). */
  selectionAnchorId: string | null
  tool: BoardTool
  dirty: boolean
  saving: boolean
  mediaMissing: Set<number>
  dropWorldAt: { x: number; y: number } | null
  undoStack: BoardUndoSnapshot[]
  redoStack: BoardUndoSnapshot[]
  saveError: string | null
  viewportSize: { width: number; height: number } | null
  setDropWorldAt: (at: { x: number; y: number } | null) => void
  setViewportSize: (width: number, height: number) => void
  pushUndoSnapshot: () => void
  undo: () => void
  redo: () => void
  focusAllItems: () => void
  setBoardsRoot: (path: string | null) => Promise<void>
  refreshSummaries: () => Promise<void>
  loadBoard: (fileName: string) => Promise<void>
  closeBoard: () => void
  setTool: (tool: BoardTool) => void
  setSelection: (ids: string[], opts?: { extend?: boolean; anchorId?: string | null }) => void
  selectItem: (
    id: string,
    opts?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }
  ) => void
  clearSelection: () => void
  selectionOrder: () => string[]
  setCamera: (camera: BoardCamera) => void
  patchDocument: (patch: Partial<BoardDocument>) => void
  setItems: (items: BoardItem[]) => void
  updateItem: (id: string, patch: Partial<BoardItem>) => void
  removeSelected: () => void
  duplicateSelected: () => void
  addMediaItems: (mediaIds: number[], at: { x: number; y: number }) => void
  addNote: (at: { x: number; y: number }) => void
  bringForward: () => void
  sendBackward: () => void
  alignSelected: (mode: Parameters<typeof alignItems>[2]) => void
  normalizeSelectedByWidth: () => void
  normalizeSelectedByHeight: () => void
  distributeSelected: (axis: 'horizontal' | 'vertical') => void
  assignGroup: (groupId: string | null) => void
  createGroupFromSelection: (label: string) => void
  ungroupSelection: () => void
  queueSave: () => void
  saveNow: () => Promise<void>
  checkMediaRefs: () => Promise<void>
}

function nextZIndex(items: BoardItem[]): number {
  if (items.length === 0) return 1
  return Math.max(...items.map((i) => i.zIndex)) + 1
}

function zOrderedItemIds(items: BoardItem[]): string[] {
  return [...items]
    .sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id))
    .map((i) => i.id)
}

function selectionOrderFromState(selection: string[], selectionAnchorId: string | null): string[] {
  if (selection.length === 0) return []
  const anchor =
    selectionAnchorId != null && selection.includes(selectionAnchorId)
      ? selectionAnchorId
      : selection[0]!
  return [anchor, ...selection.filter((id) => id !== anchor)]
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boardsRoot: null,
  summaries: [],
  activeFile: null,
  document: null,
  selection: [],
  selectionAnchorId: null,
  tool: 'select',
  dirty: false,
  saving: false,
  mediaMissing: new Set(),
  dropWorldAt: null,
  undoStack: [],
  redoStack: [],
  saveError: null,
  viewportSize: null,

  setDropWorldAt: (at) => set({ dropWorldAt: at }),

  setViewportSize: (width, height) => {
    const prev = get().viewportSize
    if (prev?.width === width && prev?.height === height) return
    set({ viewportSize: { width, height } })
  },

  pushUndoSnapshot: () => {
    if (undoRestoreActive) return
    const doc = get().document
    if (!doc) return
    set({ undoStack: pushUndoStack(get().undoStack, captureUndoSnapshot(doc)), redoStack: [] })
  },

  undo: () => {
    const { undoStack, redoStack, document, selection, selectionAnchorId } = get()
    if (!document || undoStack.length === 0) return
    const snapshot = undoStack[undoStack.length - 1]!
    const current = captureUndoSnapshot(document)
    const itemIds = new Set(snapshot.items.map((i) => i.id))
    const nextSelection = selection.filter((id) => itemIds.has(id))
    const nextAnchor =
      selectionAnchorId && itemIds.has(selectionAnchorId)
        ? selectionAnchorId
        : (nextSelection[0] ?? null)
    undoRestoreActive = true
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: pushUndoStack(redoStack, current),
      document: { ...document, items: snapshot.items, groups: snapshot.groups },
      selection: nextSelection,
      selectionAnchorId: nextAnchor,
      dirty: true
    })
    undoRestoreActive = false
    get().queueSave()
  },

  redo: () => {
    const { redoStack, undoStack, document, selection, selectionAnchorId } = get()
    if (!document || redoStack.length === 0) return
    const snapshot = redoStack[redoStack.length - 1]!
    const current = captureUndoSnapshot(document)
    const itemIds = new Set(snapshot.items.map((i) => i.id))
    const nextSelection = selection.filter((id) => itemIds.has(id))
    const nextAnchor =
      selectionAnchorId && itemIds.has(selectionAnchorId)
        ? selectionAnchorId
        : (nextSelection[0] ?? null)
    undoRestoreActive = true
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: pushUndoStack(undoStack, current),
      document: { ...document, items: snapshot.items, groups: snapshot.groups },
      selection: nextSelection,
      selectionAnchorId: nextAnchor,
      dirty: true
    })
    undoRestoreActive = false
    get().queueSave()
  },

  focusAllItems: () => {
    const { document, viewportSize } = get()
    if (!document || !viewportSize) return
    const bounds = unionRect(document.items)
    const camera = bounds
      ? cameraToFitBounds(bounds, viewportSize.width, viewportSize.height)
      : { x: 0, y: 0, scale: 1 }
    set({ document: { ...document, camera }, dirty: true })
    get().queueSave()
  },

  setBoardsRoot: async (path) => {
    await api().setRoot(path)
    set({ boardsRoot: path })
    await get().refreshSummaries()
  },

  refreshSummaries: async () => {
    const root = await api().getRoot()
    const summaries = root ? await api().list() : []
    set({ boardsRoot: root, summaries })
  },

  loadBoard: async (fileName) => {
    const document = await api().read(fileName)
    set({
      activeFile: fileName,
      document,
      selection: [],
      selectionAnchorId: null,
      dirty: false,
      tool: 'select',
      undoStack: [],
      redoStack: [],
      saveError: null
    })
    await get().checkMediaRefs()
  },

  closeBoard: () => {
    set({
      activeFile: null,
      document: null,
      selection: [],
      selectionAnchorId: null,
      dirty: false,
      undoStack: [],
      redoStack: [],
      saveError: null,
      viewportSize: null
    })
  },

  setTool: (tool) => set({ tool }),

  setSelection: (ids, opts) => {
    const { selection, selectionAnchorId } = get()
    const next = opts?.extend ? [...new Set([...selection, ...ids])] : ids
    const anchor =
      opts?.anchorId !== undefined
        ? opts.anchorId
        : opts?.extend
          ? selectionAnchorId
          : (next[0] ?? null)
    set({
      selection: next,
      selectionAnchorId: next.length === 0 ? null : anchor ?? next[0] ?? null
    })
  },

  selectItem: (id, opts = {}) => {
    const { shiftKey = false, ctrlKey = false, metaKey = false } = opts
    const additive = ctrlKey || metaKey
    const { document, selection, selectionAnchorId } = get()
    if (!document) return

    const orderedIds = zOrderedItemIds(document.items)
    const anchor = selectionAnchorId ?? selection[0] ?? null

    let nextIds: string[]
    if (shiftKey && anchor != null) {
      const ai = orderedIds.indexOf(anchor)
      const bi = orderedIds.indexOf(id)
      if (ai < 0 || bi < 0) {
        nextIds = [...new Set([...selection, id])]
      } else {
        const lo = Math.min(ai, bi)
        const hi = Math.max(ai, bi)
        nextIds = orderedIds.slice(lo, hi + 1)
      }
    } else if (additive) {
      nextIds = selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id]
    } else {
      nextIds = [id]
    }

    set({
      selection: nextIds,
      selectionAnchorId: shiftKey ? anchor : id
    })
  },

  clearSelection: () => set({ selection: [], selectionAnchorId: null }),

  selectionOrder: () => {
    const { selection, selectionAnchorId } = get()
    return selectionOrderFromState(selection, selectionAnchorId)
  },

  setCamera: (camera) => {
    const doc = get().document
    if (!doc) return
    set({ document: { ...doc, camera }, dirty: true })
    get().queueSave()
  },

  patchDocument: (patch) => {
    const doc = get().document
    if (!doc) return
    set({ document: { ...doc, ...patch }, dirty: true })
    get().queueSave()
  },

  setItems: (items) => {
    const doc = get().document
    if (!doc) return
    set({ document: { ...doc, items }, dirty: true })
    get().queueSave()
  },

  updateItem: (id, patch) => {
    const doc = get().document
    if (!doc) return
    const items = doc.items.map((item) =>
      item.id === id ? ({ ...item, ...patch } as BoardItem) : item
    )
    set({ document: { ...doc, items }, dirty: true })
    get().queueSave()
  },

  removeSelected: () => {
    const { document, selection } = get()
    if (!document || selection.length === 0) return
    get().pushUndoSnapshot()
    const sel = new Set(selection)
    set({
      document: { ...document, items: document.items.filter((i) => !sel.has(i.id)) },
      selection: [],
      selectionAnchorId: null,
      dirty: true
    })
    get().queueSave()
  },

  duplicateSelected: () => {
    const { document, selection } = get()
    if (!document || selection.length === 0) return
    get().pushUndoSnapshot()
    const sel = new Set(selection)
    const clones: BoardItem[] = []
    let z = nextZIndex(document.items)
    for (const item of document.items) {
      if (!sel.has(item.id)) continue
      clones.push({
        ...item,
        id: uuidv4(),
        x: item.x + 24,
        y: item.y + 24,
        zIndex: z++
      })
    }
    set({
      document: { ...document, items: [...document.items, ...clones] },
      selection: clones.map((c) => c.id),
      selectionAnchorId: clones[0]?.id ?? null,
      dirty: true
    })
    get().queueSave()
  },

  addMediaItems: (mediaIds, at) => {
    const doc = get().document
    if (!doc) return
    get().pushUndoSnapshot()
    void (async () => {
      let z = nextZIndex(doc.items)
      const baseWidth = 280
      const newItems: BoardMediaItem[] = []
      for (let i = 0; i < mediaIds.length; i++) {
        const mediaId = mediaIds[i]!
        const media = await window.collectionXiewer.media.get(mediaId)
        const aspect = media
          ? mediaAspectRatio(media.width, media.height, media.kind)
          : 4 / 3
        const width = baseWidth
        const height = width / aspect
        const item: BoardMediaItem = {
          id: uuidv4(),
          kind: 'media',
          mediaId,
          x: at.x + i * 20,
          y: at.y + i * 20,
          width,
          height,
          aspectRatio: aspect,
          rotation: 0,
          flipX: false,
          flipY: false,
          opacity: 1,
          zIndex: z++,
          locked: false,
          groupId: null
        }
        newItems.push(item)
      }
      const latest = get().document
      if (!latest) return
      set({
        document: { ...latest, items: [...latest.items, ...newItems] },
        selection: newItems.map((n) => n.id),
        selectionAnchorId: newItems[0]?.id ?? null,
        dirty: true
      })
      get().queueSave()
      void get().checkMediaRefs()
    })()
  },

  addNote: (at) => {
    const doc = get().document
    if (!doc) return
    get().pushUndoSnapshot()
    const note: BoardNoteItem = {
      id: uuidv4(),
      kind: 'note',
      x: at.x,
      y: at.y,
      width: 220,
      height: 120,
      rotation: 0,
      zIndex: nextZIndex(doc.items),
      locked: false,
      text: 'Note',
      fontSize: 14,
      color: '#e8e8e8',
      groupId: null
    }
    set({
      document: { ...doc, items: [...doc.items, note] },
      selection: [note.id],
      selectionAnchorId: note.id,
      dirty: true
    })
    get().queueSave()
  },

  bringForward: () => {
    const { document, selection } = get()
    if (!document || selection.length === 0) return
    get().pushUndoSnapshot()
    get().setItems(moveSelectionInStack(document.items, new Set(selection), 'forward'))
  },

  sendBackward: () => {
    const { document, selection } = get()
    if (!document || selection.length === 0) return
    get().pushUndoSnapshot()
    get().setItems(moveSelectionInStack(document.items, new Set(selection), 'backward'))
  },

  alignSelected: (mode) => {
    const { document, selection } = get()
    if (!document || selection.length === 0) return
    get().pushUndoSnapshot()
    const order = get().selectionOrder()
    const items = alignItems(document.items, order, mode)
    get().setItems(items)
  },

  normalizeSelectedByWidth: () => {
    const { document, selection } = get()
    if (!document || selection.length === 0) return
    get().pushUndoSnapshot()
    const order = get().selectionOrder()
    const anchorId = order[0]
    const anchor = document.items.find((i) => i.id === anchorId)
    if (!anchor || anchor.kind !== 'media') return
    const targetWidth = anchor.width
    const sel = new Set(selection)
    const items = document.items.map((item) => {
      if (!sel.has(item.id) || item.kind !== 'media' || item.id === anchorId) return item
      return { ...item, ...normalizeMediaToWidth(item, targetWidth) }
    })
    get().setItems(items)
  },

  normalizeSelectedByHeight: () => {
    const { document, selection } = get()
    if (!document || selection.length === 0) return
    get().pushUndoSnapshot()
    const order = get().selectionOrder()
    const anchorId = order[0]
    const anchor = document.items.find((i) => i.id === anchorId)
    if (!anchor || anchor.kind !== 'media') return
    const targetHeight = anchor.height
    const sel = new Set(selection)
    const items = document.items.map((item) => {
      if (!sel.has(item.id) || item.kind !== 'media' || item.id === anchorId) return item
      return { ...item, ...normalizeMediaToHeight(item, targetHeight) }
    })
    get().setItems(items)
  },

  distributeSelected: (axis) => {
    const { document, selection } = get()
    if (!document || selection.length < 3) return
    get().pushUndoSnapshot()
    const items = distributeItems(document.items, new Set(selection), axis)
    get().setItems(items)
  },

  assignGroup: (groupId) => {
    const { document, selection } = get()
    if (!document || selection.length === 0) return
    get().pushUndoSnapshot()
    const sel = new Set(selection)
    const items = document.items.map((item) =>
      sel.has(item.id) ? { ...item, groupId } : item
    )
    get().setItems(items)
  },

  createGroupFromSelection: (label) => {
    const { document, selection } = get()
    if (!document || selection.length === 0) return
    get().pushUndoSnapshot()
    const groupId = uuidv4()
    const groups = [...document.groups, { id: groupId, label, locked: false }]
    const sel = new Set(selection)
    const items = document.items.map((item) =>
      sel.has(item.id) ? { ...item, groupId } : item
    )
    set({ document: { ...document, groups, items }, dirty: true })
    get().queueSave()
  },

  ungroupSelection: () => {
    const { document, selection } = get()
    if (!document || selection.length === 0) return
    get().pushUndoSnapshot()
    const sel = new Set(selection)
    const items = document.items.map((item) =>
      sel.has(item.id) ? { ...item, groupId: null } : item
    )
    const usedGroupIds = new Set(
      items.map((item) => item.groupId).filter((id): id is string => id != null)
    )
    const groups = document.groups.filter((g) => usedGroupIds.has(g.id))
    set({ document: { ...document, groups, items }, dirty: true })
    get().queueSave()
  },

  queueSave: () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void get().saveNow()
    }, 500)
  },

  saveNow: async () => {
    const { activeFile, document, dirty } = get()
    if (!activeFile || !document || !dirty) return
    set({ saving: true, saveError: null })
    try {
      const saved = await api().write(activeFile, document)
      set({ document: saved, dirty: false, saveError: null })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save board.'
      set({ saveError: message })
      showError(message)
    } finally {
      set({ saving: false })
    }
  },

  checkMediaRefs: async () => {
    const doc = get().document
    if (!doc) return
    const missing = new Set<number>()
    const mediaIds = [
      ...new Set(doc.items.filter((i) => i.kind === 'media').map((i) => i.mediaId))
    ]
    for (const id of mediaIds) {
      const m = await window.collectionXiewer.media.get(id)
      if (!m || m.missing) missing.add(id)
    }
    set({ mediaMissing: missing })
  }
}))
