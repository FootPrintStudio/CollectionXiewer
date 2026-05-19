import { useRef } from 'react'
import type { BoardItem } from '../../../shared/boardSchema'
import {
  resizeBoardItem,
  rotationFromPointer,
  worldDeltaToLocal
} from '../../lib/boardItemTransforms'
import { useBoardStore } from '../../store/boardStore'

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const

type DragMode =
  | { kind: 'resize'; handle: string; startX: number; startY: number; orig: BoardItem }
  | { kind: 'rotate'; startAngle: number; startRot: number; orig: BoardItem }

interface Props {
  item: BoardItem
  camera: { x: number; y: number; scale: number }
  viewportRect: () => DOMRect | undefined
  lockAspect: number | null
}

export function BoardItemHandles({ item, camera, viewportRect, lockAspect }: Props) {
  const updateItem = useBoardStore((s) => s.updateItem)
  const pushUndoSnapshot = useBoardStore((s) => s.pushUndoSnapshot)
  const dragRef = useRef<DragMode | null>(null)

  const bindDrag = (mode: DragMode) => {
    pushUndoSnapshot()
    dragRef.current = mode
    document.body.classList.add('panel-resize-active')

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const scale = camera.scale

      if (drag.kind === 'resize') {
        const dx = (e.clientX - drag.startX) / scale
        const dy = (e.clientY - drag.startY) / scale
        const local = worldDeltaToLocal(dx, dy, drag.orig.rotation)
        const patch = resizeBoardItem(drag.orig, drag.handle, local.x, local.y, lockAspect)
        updateItem(drag.orig.id, patch)
        return
      }

      const rect = viewportRect()
      if (!rect) return
      const rotation = rotationFromPointer(
        drag.orig,
        e.clientX,
        e.clientY,
        rect,
        camera,
        drag.startAngle,
        drag.startRot
      )
      updateItem(drag.orig.id, { rotation })
    }

    const onUp = () => {
      dragRef.current = null
      document.body.classList.remove('panel-resize-active')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const startResize = (handle: string, e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    bindDrag({
      kind: 'resize',
      handle,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...item }
    })
  }

  const startRotate = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const rect = viewportRect()
    if (!rect) return
    const cx = item.x + item.width / 2
    const cy = item.y + item.height / 2
    const centerX = cx * camera.scale + camera.x + rect.left
    const centerY = cy * camera.scale + camera.y + rect.top
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX)
    bindDrag({
      kind: 'rotate',
      startAngle,
      startRot: item.rotation,
      orig: { ...item }
    })
  }

  return (
    <div className="board-item-handles" aria-hidden>
      {HANDLES.map((h) => (
        <button
          key={h}
          type="button"
          className={`board-handle board-handle--${h}`}
          style={{
            left: h.includes('e') ? '100%' : h.includes('w') ? 0 : '50%',
            top: h.includes('s') ? '100%' : h.includes('n') ? 0 : '50%'
          }}
          onPointerDown={(e) => startResize(h, e)}
        />
      ))}
      <button
        type="button"
        className="board-handle board-handle--rotate"
        style={{ left: '50%', top: 0 }}
        onPointerDown={startRotate}
      />
    </div>
  )
}
