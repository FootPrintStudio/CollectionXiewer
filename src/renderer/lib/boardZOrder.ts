import type { BoardItem } from '../../shared/boardSchema'

export function compareBoardItemsByZ(a: BoardItem, b: BoardItem): number {
  return a.zIndex - b.zIndex || a.id.localeCompare(b.id)
}

/** Move selection one step in the paint order (swap with the nearest non-selected neighbor). */
export function moveSelectionInStack(
  items: BoardItem[],
  selection: ReadonlySet<string>,
  direction: 'forward' | 'backward'
): BoardItem[] {
  if (selection.size === 0) return items

  const ordered = [...items].sort(compareBoardItemsByZ)

  if (direction === 'forward') {
    for (let i = ordered.length - 2; i >= 0; i--) {
      const cur = ordered[i]!
      const next = ordered[i + 1]!
      if (selection.has(cur.id) && !selection.has(next.id)) {
        ordered[i] = next
        ordered[i + 1] = cur
      }
    }
  } else {
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1]!
      const cur = ordered[i]!
      if (selection.has(cur.id) && !selection.has(prev.id)) {
        ordered[i - 1] = cur
        ordered[i] = prev
      }
    }
  }

  const idToZ = new Map(ordered.map((item, index) => [item.id, index + 1]))
  return items.map((item) => ({
    ...item,
    zIndex: idToZ.get(item.id) ?? item.zIndex
  }))
}
