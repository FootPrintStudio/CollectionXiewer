import { alignItems, cameraToFitBounds, itemRect, rectsIntersect } from './boardLayout'
import type { BoardItem, BoardMediaItem } from '../../shared/boardSchema'

function media(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number
): BoardMediaItem {
  return {
    id,
    kind: 'media',
    mediaId: 1,
    x,
    y,
    width,
    height,
    rotation: 0,
    zIndex: 1,
    locked: false,
    flipX: false,
    flipY: false,
    opacity: 1
  }
}

function selectionOverlaps(items: BoardItem[], order: string[]): boolean {
  const selected = order.map((id) => items.find((i) => i.id === id)!).filter(Boolean)
  for (let i = 0; i < selected.length; i++) {
    for (let j = i + 1; j < selected.length; j++) {
      if (rectsIntersect(itemRect(selected[i]!), itemRect(selected[j]!))) return true
    }
  }
  return false
}

const scattered = [
  media('w1', 20, 20, 140, 70),
  media('w2', 200, 30, 60, 120),
  media('w3', 320, 160, 70, 90),
  media('w4', 30, 220, 100, 80),
  media('w5', 200, 210, 90, 85)
]
const order = ['w1', 'w2', 'w3', 'w4', 'w5']
const T = 20
const B = 300
const L = 20
const R = 390

// Align right: guide = R; closest first; stack left on 2D overlap
{
  const next = alignItems(scattered, order, 'right')
  const w1 = next.find((i) => i.id === 'w1')!
  const w2 = next.find((i) => i.id === 'w2')!
  const w3 = next.find((i) => i.id === 'w3')!
  const w4 = next.find((i) => i.id === 'w4')!
  const w5 = next.find((i) => i.id === 'w5')!

  if (w1.x + w1.width > w2.x) throw new Error('w1 should stack left of w2')
  if (Math.abs(w2.x + w2.width - R) > 1) throw new Error('w2 right edge at guide')
  if (Math.abs(w3.x + w3.width - R) > 1) throw new Error('w3 right edge at guide')
  if (rectsIntersect(itemRect(w2), itemRect(w3)))
    throw new Error('w2 and w3 should not overlap')
  if (w4.x + w4.width > w5.x) throw new Error('w4 should stack left of w5')
  if (selectionOverlaps(next, order)) throw new Error('align right should not overlap')
}

// Align top: guide T = min(y); stack down on overlap
{
  const next = alignItems(scattered, order, 'top')
  const w1 = next.find((i) => i.id === 'w1')!
  const w2 = next.find((i) => i.id === 'w2')!
  const w4 = next.find((i) => i.id === 'w4')!
  const w5 = next.find((i) => i.id === 'w5')!

  if (w1.y !== T) throw new Error('w1 top at guide')
  if (w2.y !== T) throw new Error('w2 top at guide (no x overlap with w1)')
  if (w4.y !== 98) throw new Error('w4 stacks below w1')
  if (w5.y !== 148) throw new Error('w5 stacks below w2')
  if (selectionOverlaps(next, order)) throw new Error('align top should not overlap')
}

// Align bottom: guide B = max(bottom); stack up on overlap
{
  const next = alignItems(scattered, order, 'bottom')
  const w3 = next.find((i) => i.id === 'w3')!
  const w4 = next.find((i) => i.id === 'w4')!
  const w5 = next.find((i) => i.id === 'w5')!

  if (w3.y + w3.height !== B) throw new Error('w3 bottom at guide')
  if (w4.y + w4.height !== B) throw new Error('w4 bottom at guide')
  if (w5.y + w5.height !== B) throw new Error('w5 bottom at guide')
  if (selectionOverlaps(next, order)) throw new Error('align bottom should not overlap')
}

// Align left: mirror of right
{
  const next = alignItems(scattered, order, 'left')
  const w1 = next.find((i) => i.id === 'w1')!
  const w2 = next.find((i) => i.id === 'w2')!
  const w3 = next.find((i) => i.id === 'w3')!
  const w4 = next.find((i) => i.id === 'w4')!
  const w5 = next.find((i) => i.id === 'w5')!

  if (w1.x !== L) throw new Error('w1 left edge at guide')
  if (w2.x !== 168) throw new Error('w2 stacks right of w1')
  if (w3.x !== 226) throw new Error('w3 stacks right of w2')
  if (w4.x !== L) throw new Error('w4 left edge at guide')
  if (w5.x !== 128) throw new Error('w5 stacks right of w4')
  if (selectionOverlaps(next, order)) throw new Error('align left should not overlap')
}

// Row: align left — no vertical overlap means same x at guide is fine
{
  const row = [
    media('a', 0, 0, 80, 40),
    media('b', 120, 0, 80, 40),
    media('c', 60, 100, 80, 40)
  ]
  const next = alignItems(row, ['a', 'b', 'c'], 'left')
  const a = next.find((i) => i.id === 'a')!
  const b = next.find((i) => i.id === 'b')!
  const c = next.find((i) => i.id === 'c')!
  if (a.x !== 0 || c.x !== 0) throw new Error('a and c on left guide (no y overlap)')
  if (b.x !== 88) throw new Error('b stacks right of a (same row at guide)')
}

// Proximity order: topmost item placed on guide first
{
  const items = [
    media('low', 0, 100, 50, 50),
    media('high', 0, 10, 50, 50),
    media('mid', 100, 50, 50, 50)
  ]
  const next = alignItems(items, ['low', 'high', 'mid'], 'top')
  const high = next.find((i) => i.id === 'high')!
  const low = next.find((i) => i.id === 'low')!
  if (high.y !== 10) throw new Error('closest to top guide stays on guide line')
  if (low.y !== 10 + 50 + 8) throw new Error('lower item stacks under higher at same x')
}

// Right then top: tops on guide; w3 stacks below w2 (x overlap at guide row)
{
  const afterRight = alignItems(scattered, order, 'right')
  const topRow = ['w1', 'w2', 'w3']
  const afterTop = alignItems(afterRight, topRow, 'top')
  const w1 = afterTop.find((i) => i.id === 'w1')!
  const w2 = afterTop.find((i) => i.id === 'w2')!
  const w3 = afterTop.find((i) => i.id === 'w3')!
  if (w1.y !== T || w2.y !== T) throw new Error('w1/w2 tops on guide')
  if (w3.y !== w2.y + w2.height + 8) throw new Error('w3 stacks below w2 after top align')
  if (selectionOverlaps(afterTop, topRow)) throw new Error('right then top should not overlap')
}

{
  const cam = cameraToFitBounds(
    { x: 100, y: 50, width: 200, height: 100 },
    800,
    600,
    { padding: 0, minScale: 0.05, maxScale: 8 }
  )
  const cx = 100 + 100
  const cy = 50 + 50
  const screenCx = cx * cam.scale + cam.x
  const screenCy = cy * cam.scale + cam.y
  if (Math.abs(screenCx - 400) > 0.01 || Math.abs(screenCy - 300) > 0.01) {
    throw new Error('cameraToFitBounds should center bounds in viewport')
  }
}

console.log('boardLayout.test.ts: ok')
