import type { BoardCamera, BoardItem } from '../../shared/boardSchema'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function itemRect(item: BoardItem): Rect {
  return { x: item.x, y: item.y, width: item.width, height: item.height }
}

export function unionRect(items: BoardItem[]): Rect | null {
  if (items.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const item of items) {
    minX = Math.min(minX, item.x)
    minY = Math.min(minY, item.y)
    maxX = Math.max(maxX, item.x + item.width)
    maxY = Math.max(maxY, item.y + item.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function patchItems(
  items: BoardItem[],
  ids: Set<string>,
  patch: (item: BoardItem) => BoardItem
): BoardItem[] {
  return items.map((item) => (ids.has(item.id) ? patch(item) : item))
}

export type BoardAlignMode = 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV'

export const BOARD_ALIGN_OPTIONS: { value: BoardAlignMode; label: string }[] = [
  { value: 'left', label: 'Align left' },
  { value: 'right', label: 'Align right' },
  { value: 'top', label: 'Align top' },
  { value: 'bottom', label: 'Align bottom' },
  { value: 'centerH', label: 'Align center horizontally' },
  { value: 'centerV', label: 'Align center vertically' }
]

export type SelectionLayout = 'row' | 'column'

/** Row = items spread more horizontally; column = spread more vertically. */
export function detectSelectionLayout(selected: BoardItem[]): SelectionLayout {
  if (selected.length <= 1) return 'row'
  let minCx = Infinity
  let maxCx = -Infinity
  let minCy = Infinity
  let maxCy = -Infinity
  for (const item of selected) {
    const cx = item.x + item.width / 2
    const cy = item.y + item.height / 2
    minCx = Math.min(minCx, cx)
    maxCx = Math.max(maxCx, cx)
    minCy = Math.min(minCy, cy)
    maxCy = Math.max(maxCy, cy)
  }
  const xSpread = maxCx - minCx
  const ySpread = maxCy - minCy
  return xSpread >= ySpread ? 'row' : 'column'
}

const COLLAPSE_GAP = 8

type Placed = { item: BoardItem; x: number; y: number }
type GuideEdgeMode = 'top' | 'bottom' | 'left' | 'right'

function overlapOnX(a: Placed, b: Placed): boolean {
  return a.x < b.x + b.item.width && a.x + a.item.width > b.x
}

function overlapOnY(a: Placed, b: Placed): boolean {
  return a.y < b.y + b.item.height && a.y + a.item.height > b.y
}

function placedRectsIntersect(a: Placed, b: Placed): boolean {
  return overlapOnX(a, b) && overlapOnY(a, b)
}

function distanceToGuide(item: BoardItem, mode: GuideEdgeMode, guide: number): number {
  switch (mode) {
    case 'top':
      return item.y - guide
    case 'bottom':
      return guide - (item.y + item.height)
    case 'left':
      return item.x - guide
    case 'right':
      return guide - (item.x + item.width)
  }
}

function sortByProximityToGuide(
  selected: BoardItem[],
  selectionOrder: string[],
  mode: GuideEdgeMode,
  guide: number
): BoardItem[] {
  const orderIndex = new Map(selectionOrder.map((id, i) => [id, i]))
  return [...selected].sort((a, b) => {
    const da = distanceToGuide(a, mode, guide)
    const db = distanceToGuide(b, mode, guide)
    if (Math.abs(da - db) > 0.001) return da - db
    return (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0)
  })
}

function resolveStackCollisions(
  item: BoardItem,
  x: number,
  y: number,
  mode: GuideEdgeMode,
  placed: Placed[]
): { x: number; y: number } {
  let changed = true
  while (changed) {
    changed = false
    const candidate = (): Placed => ({ item, x, y })
    for (const p of placed) {
      if (!placedRectsIntersect(candidate(), p)) continue
      switch (mode) {
        case 'top':
          y = Math.max(y, p.y + p.item.height + COLLAPSE_GAP)
          break
        case 'bottom':
          y = Math.min(y, p.y - item.height - COLLAPSE_GAP)
          break
        case 'left':
          x = Math.max(x, p.x + p.item.width + COLLAPSE_GAP)
          break
        case 'right':
          x = Math.min(x, p.x - item.width - COLLAPSE_GAP)
          break
      }
      changed = true
    }
  }
  return { x, y }
}

/**
 * Extremal edge in the selection is the guide. Items align to that edge unless
 * they would overlap an already-placed item; then they stack away with COLLAPSE_GAP.
 * Placement order: closest to the guide first (tie-break: selection order).
 */
function alignToGuideEdge(
  selected: BoardItem[],
  selectionOrder: string[],
  mode: GuideEdgeMode
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>()
  if (selected.length === 0) return out

  const T = Math.min(...selected.map((i) => i.y))
  const B = Math.max(...selected.map((i) => i.y + i.height))
  const L = Math.min(...selected.map((i) => i.x))
  const R = Math.max(...selected.map((i) => i.x + i.width))

  const guide = mode === 'top' ? T : mode === 'bottom' ? B : mode === 'left' ? L : R
  const ordered = sortByProximityToGuide(selected, selectionOrder, mode, guide)
  const placed: Placed[] = []

  for (const item of ordered) {
    let x = item.x
    let y = item.y
    switch (mode) {
      case 'top':
        y = T
        break
      case 'bottom':
        y = B - item.height
        break
      case 'left':
        x = L
        break
      case 'right':
        x = R - item.width
        break
    }
    const resolved = resolveStackCollisions(item, x, y, mode, placed)
    placed.push({ item, x: resolved.x, y: resolved.y })
    out.set(item.id, resolved)
  }

  return out
}

function alignCollapseCenterH(selected: BoardItem[], anchor: BoardItem): Map<string, { x: number; y: number }> {
  const anchorCx = anchor.x + anchor.width / 2
  const out = new Map<string, { x: number; y: number }>()
  const placed: Placed[] = []
  const ordered = [...selected].sort((a, b) => b.x + b.width - (a.x + a.width))

  for (const item of ordered) {
    let x = anchorCx - item.width / 2
    const y = item.y
    const candidate = (): Placed => ({ item, x, y })
    for (const p of placed) {
      if (!placedRectsIntersect(candidate(), p)) continue
      x = Math.min(x, p.x - COLLAPSE_GAP - item.width)
    }
    for (const p of placed) {
      if (!placedRectsIntersect(candidate(), p)) continue
      x = Math.max(x, p.x + p.item.width + COLLAPSE_GAP)
    }
    placed.push({ item, x, y })
    out.set(item.id, { x, y })
  }

  return out
}

function alignCenterV(selected: BoardItem[], anchor: BoardItem): Map<string, { x: number; y: number }> {
  const anchorCy = anchor.y + anchor.height / 2
  const out = new Map<string, { x: number; y: number }>()
  for (const item of selected) {
    if (item.id === anchor.id) {
      out.set(item.id, { x: item.x, y: item.y })
    } else {
      out.set(item.id, { x: item.x, y: anchorCy - item.height / 2 })
    }
  }
  return out
}

/**
 * Align selection. Top/bottom/left/right use guide-edge stacking; center modes use anchor.
 */
export function alignItems(
  items: BoardItem[],
  selectionOrder: string[],
  mode: BoardAlignMode
): BoardItem[] {
  if (selectionOrder.length === 0) return items

  const ids = new Set(selectionOrder)
  const selected = selectionOrder
    .map((id) => items.find((i) => i.id === id))
    .filter((item): item is BoardItem => item != null)

  if (selected.length === 0) return items

  const anchor = selected[0]!

  let positions: Map<string, { x: number; y: number }>
  switch (mode) {
    case 'top':
    case 'bottom':
    case 'left':
    case 'right':
      positions = alignToGuideEdge(selected, selectionOrder, mode)
      break
    case 'centerH':
      positions = alignCollapseCenterH(selected, anchor)
      break
    case 'centerV':
      positions = alignCenterV(selected, anchor)
      break
    default:
      positions = alignToGuideEdge(selected, selectionOrder, 'right')
  }

  return patchItems(items, ids, (item) => {
    const pos = positions.get(item.id)
    if (!pos) return item
    return { ...item, x: pos.x, y: pos.y }
  })
}

export function distributeItems(
  items: BoardItem[],
  ids: Set<string>,
  axis: 'horizontal' | 'vertical'
): BoardItem[] {
  const selected = [...items.filter((i) => ids.has(i.id))].sort((a, b) =>
    axis === 'horizontal' ? a.x - b.x : a.y - b.y
  )
  if (selected.length < 3) return items
  const first = selected[0]!
  const last = selected[selected.length - 1]!
  const totalSpan =
    axis === 'horizontal'
      ? last.x + last.width - first.x
      : last.y + last.height - first.y
  const totalSize = selected.reduce(
    (s, i) => s + (axis === 'horizontal' ? i.width : i.height),
    0
  )
  const gap = (totalSpan - totalSize) / (selected.length - 1)
  let cursor = axis === 'horizontal' ? first.x : first.y
  const positions = new Map<string, number>()
  for (const item of selected) {
    positions.set(item.id, cursor)
    cursor += (axis === 'horizontal' ? item.width : item.height) + gap
  }
  return patchItems(items, ids, (item) => {
    const pos = positions.get(item.id)
    if (pos == null) return item
    return axis === 'horizontal' ? { ...item, x: pos } : { ...item, y: pos }
  })
}

export function screenToWorld(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  camera: { x: number; y: number; scale: number }
): { x: number; y: number } {
  const sx = clientX - rect.left
  const sy = clientY - rect.top
  return {
    x: (sx - camera.x) / camera.scale,
    y: (sy - camera.y) / camera.scale
  }
}

export function worldToScreen(
  wx: number,
  wy: number,
  rect: DOMRect,
  camera: { x: number; y: number; scale: number }
): { x: number; y: number } {
  return {
    x: wx * camera.scale + camera.x + rect.left,
    y: wy * camera.scale + camera.y + rect.top
  }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

/** Pan/zoom camera so `bounds` fits inside the viewport (viewport-local coordinates). */
export function cameraToFitBounds(
  bounds: Rect,
  viewportWidth: number,
  viewportHeight: number,
  options?: { padding?: number; minScale?: number; maxScale?: number }
): BoardCamera {
  const padding = options?.padding ?? 48
  const minScale = options?.minScale ?? 0.05
  const maxScale = options?.maxScale ?? 8
  const w = Math.max(bounds.width, 1)
  const h = Math.max(bounds.height, 1)
  const availW = Math.max(viewportWidth - padding * 2, 1)
  const availH = Math.max(viewportHeight - padding * 2, 1)
  const scale = Math.min(
    maxScale,
    Math.max(minScale, Math.min(availW / w, availH / h))
  )
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  return {
    scale,
    x: viewportWidth / 2 - cx * scale,
    y: viewportHeight / 2 - cy * scale
  }
}
