import type { BoardDocument, BoardGroup, BoardItem } from '../../shared/boardSchema'

export const BOARD_UNDO_LIMIT = 5

export type BoardUndoSnapshot = {
  items: BoardItem[]
  groups: BoardGroup[]
}

export function captureUndoSnapshot(doc: BoardDocument): BoardUndoSnapshot {
  return {
    items: structuredClone(doc.items),
    groups: structuredClone(doc.groups)
  }
}

export function pushUndoStack(
  stack: BoardUndoSnapshot[],
  snapshot: BoardUndoSnapshot
): BoardUndoSnapshot[] {
  const next = [...stack, snapshot]
  if (next.length > BOARD_UNDO_LIMIT) return next.slice(-BOARD_UNDO_LIMIT)
  return next
}
