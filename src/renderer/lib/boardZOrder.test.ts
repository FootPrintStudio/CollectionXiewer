import { moveSelectionInStack } from './boardZOrder'
import type { BoardMediaItem } from '../../shared/boardSchema'

function media(id: string, zIndex: number): BoardMediaItem {
  return {
    id,
    kind: 'media',
    mediaId: 1,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    zIndex,
    locked: false,
    flipX: false,
    flipY: false,
    opacity: 1
  }
}

{
  const items = [media('a', 1), media('b', 2), media('c', 3)]
  const next = moveSelectionInStack(items, new Set(['b']), 'forward')
  const b = next.find((i) => i.id === 'b')!
  const c = next.find((i) => i.id === 'c')!
  if (b.zIndex <= c.zIndex) throw new Error('b should move above c')
}

{
  const items = [media('a', 1), media('b', 2), media('c', 3)]
  const next = moveSelectionInStack(items, new Set(['b']), 'backward')
  const a = next.find((i) => i.id === 'a')!
  const b = next.find((i) => i.id === 'b')!
  if (b.zIndex >= a.zIndex) throw new Error('b should move below a')
}

console.log('boardZOrder.test.ts: ok')
