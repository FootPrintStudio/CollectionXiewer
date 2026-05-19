import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { BoardItem } from '../../../shared/boardSchema'
import { BOARD_DROP_ID } from '../../dnd/boardDnd'
import { rectsIntersect, screenToWorld, itemRect } from '../../lib/boardLayout'
import { useBoardStore } from '../../store/boardStore'
import { BoardItemView } from './BoardItemView'
import { isEditableTarget } from '../../lib/keyboardTargets'

const MIN_SCALE = 0.05
const MAX_SCALE = 8
const ZOOM_STEP = 0.1

type DragMode =
  | { kind: 'pan'; startX: number; startY: number; camX: number; camY: number }
  | { kind: 'move'; ids: string[]; startX: number; startY: number; origins: Map<string, { x: number; y: number }> }
  | { kind: 'marquee'; startX: number; startY: number; endX: number; endY: number }

export function BoardCanvas() {
  const document = useBoardStore((s) => s.document)
  const selection = useBoardStore((s) => s.selection)
  const tool = useBoardStore((s) => s.tool)
  const setCamera = useBoardStore((s) => s.setCamera)
  const setSelection = useBoardStore((s) => s.setSelection)
  const selectItem = useBoardStore((s) => s.selectItem)
  const clearSelection = useBoardStore((s) => s.clearSelection)
  const updateItem = useBoardStore((s) => s.updateItem)
  const setDropWorldAt = useBoardStore((s) => s.setDropWorldAt)
  const setViewportSize = useBoardStore((s) => s.setViewportSize)
  const pushUndoSnapshot = useBoardStore((s) => s.pushUndoSnapshot)
  const undo = useBoardStore((s) => s.undo)

  const viewportRef = useRef<HTMLDivElement>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const dragRef = useRef<DragMode | null>(null)
  const itemClickRef = useRef<{
    id: string
    startX: number
    startY: number
    wasSelected: boolean
    additive: boolean
  } | null>(null)
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  const { setNodeRef, isOver } = useDroppable({ id: BOARD_DROP_ID })

  const camera = document?.camera ?? { x: 0, y: 0, scale: 1 }
  const items = document?.items ?? []
  const sorted = useMemo(() => [...items].sort((a, b) => a.zIndex - b.zIndex), [items])

  const getRect = () => viewportRef.current?.getBoundingClientRect()

  const updateDropAt = useCallback(
    (clientX: number, clientY: number) => {
      const rect = getRect()
      if (!rect) return
      setDropWorldAt(screenToWorld(clientX, clientY, rect, camera))
    },
    [camera, setDropWorldAt]
  )

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      if (e.code === 'Space') {
        e.preventDefault()
        setSpaceHeld(true)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [undo])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const sync = () => {
      const r = el.getBoundingClientRect()
      setViewportSize(r.width, r.height)
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [setViewportSize, document])

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const rect = getRect()
      if (!rect || !document) return
      const factor = e.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, camera.scale * factor))
      const before = screenToWorld(e.clientX, e.clientY, rect, camera)
      const newCam = { ...camera, scale: newScale }
      const after = screenToWorld(e.clientX, e.clientY, rect, newCam)
      setCamera({
        x: camera.x + (after.x - before.x) * newScale,
        y: camera.y + (after.y - before.y) * newScale,
        scale: newScale
      })
    },
    [camera, document, setCamera]
  )

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const startPan = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return
    const panMode = e.button === 1 || spaceHeld || tool === 'pan'
    if (!panMode) return
    e.preventDefault()
    dragRef.current = {
      kind: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      camX: camera.x,
      camY: camera.y
    }
    viewportRef.current?.setPointerCapture(e.pointerId)
  }

  const onViewportPointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('board-world')) {
      return
    }
    updateDropAt(e.clientX, e.clientY)
    if (e.button === 1 || spaceHeld || tool === 'pan') {
      startPan(e)
      return
    }
    if (tool === 'note') {
      const rect = getRect()
      if (!rect) return
      const at = screenToWorld(e.clientX, e.clientY, rect, camera)
      useBoardStore.getState().addNote(at)
      return
    }
    if (e.button === 0) {
      if (e.shiftKey) e.preventDefault()
      clearSelection()
      dragRef.current = {
        kind: 'marquee',
        startX: e.clientX,
        startY: e.clientY,
        endX: e.clientX,
        endY: e.clientY
      }
      viewportRef.current?.setPointerCapture(e.pointerId)
    }
  }

  const onItemPointerDown = (item: BoardItem, e: React.PointerEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = {
        kind: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        camX: camera.x,
        camY: camera.y
      }
      viewportRef.current?.setPointerCapture(e.pointerId)
      return
    }
    if (e.button !== 0) return
    if (item.locked) return
    const group = item.groupId
      ? document?.groups.find((g) => g.id === item.groupId)
      : null
    if (group?.locked) return
    e.stopPropagation()
    updateDropAt(e.clientX, e.clientY)

    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault()
    }

    const wasSelected = selection.includes(item.id)
    const additive = e.ctrlKey || e.metaKey
    itemClickRef.current = {
      id: item.id,
      startX: e.clientX,
      startY: e.clientY,
      wasSelected,
      additive
    }

    const st = useBoardStore.getState()
    if (!wasSelected || e.shiftKey) {
      selectItem(item.id, {
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey
      })
    }
    let ids = useBoardStore.getState().selection
    if (item.groupId && !e.shiftKey && !additive) {
      const groupIds = items.filter((i) => i.groupId === item.groupId).map((i) => i.id)
      ids = [...new Set([...ids, ...groupIds])]
      setSelection(ids, { anchorId: st.selectionAnchorId ?? item.id })
    }
    const origins = new Map<string, { x: number; y: number }>()
    for (const id of ids) {
      const it = items.find((i) => i.id === id)
      if (it && !it.locked) origins.set(id, { x: it.x, y: it.y })
    }
    if (origins.size > 0) pushUndoSnapshot()
    dragRef.current = {
      kind: 'move',
      ids,
      startX: e.clientX,
      startY: e.clientY,
      origins
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const rect = getRect()
    if (!rect) return

    if (drag.kind === 'pan') {
      setCamera({
        ...camera,
        x: drag.camX + (e.clientX - drag.startX),
        y: drag.camY + (e.clientY - drag.startY)
      })
      return
    }

    if (drag.kind === 'marquee') {
      dragRef.current = { ...drag, endX: e.clientX, endY: e.clientY }
      setMarquee({ x1: drag.startX, y1: drag.startY, x2: e.clientX, y2: e.clientY })
      return
    }

    if (drag.kind === 'move') {
      const dx = (e.clientX - drag.startX) / camera.scale
      const dy = (e.clientY - drag.startY) / camera.scale
      for (const id of drag.ids) {
        const o = drag.origins.get(id)
        if (!o) continue
        updateItem(id, { x: o.x + dx, y: o.y + dy })
      }
      return
    }

  }

  const endDrag = (e: React.PointerEvent) => {
    const drag = dragRef.current
    dragRef.current = null
    const click = itemClickRef.current
    itemClickRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }

    if (click && drag?.kind === 'move') {
      const moved = Math.hypot(e.clientX - click.startX, e.clientY - click.startY) > 4
      if (click.additive && click.wasSelected && !moved) {
        selectItem(click.id, { ctrlKey: true, metaKey: true })
      }
    }

    if (drag?.kind === 'marquee' && document) {
      const rect = getRect()
      if (rect) {
        const x1 = Math.min(drag.startX, drag.endX)
        const y1 = Math.min(drag.startY, drag.endY)
        const x2 = Math.max(drag.startX, drag.endX)
        const y2 = Math.max(drag.startY, drag.endY)
        const w1 = screenToWorld(x1, y1, rect, camera)
        const w2 = screenToWorld(x2, y2, rect, camera)
        const selRect = {
          x: Math.min(w1.x, w2.x),
          y: Math.min(w1.y, w2.y),
          width: Math.abs(w2.x - w1.x),
          height: Math.abs(w2.y - w1.y)
        }
        const hits = items.filter((it) => rectsIntersect(itemRect(it), selRect)).map((it) => it.id)
        if (e.shiftKey) {
          setSelection(hits, { extend: true })
        } else {
          setSelection(hits, { anchorId: hits[0] ?? null })
        }
      }
    }
    setMarquee(null)
  }

  const visibleItems = useMemo(() => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return sorted
    const pad = 200
    const w1 = screenToWorld(rect.left - pad, rect.top - pad, rect, camera)
    const w2 = screenToWorld(rect.right + pad, rect.bottom + pad, rect, camera)
    const view = {
      x: Math.min(w1.x, w2.x),
      y: Math.min(w1.y, w2.y),
      width: Math.abs(w2.x - w1.x),
      height: Math.abs(w2.y - w1.y)
    }
    return sorted.filter((it) => rectsIntersect(itemRect(it), view))
  }, [sorted, camera])

  if (!document) return null

  return (
    <div
      ref={(el) => {
        viewportRef.current = el
        setNodeRef(el)
      }}
      className={`board-canvas${isOver ? ' board-canvas--drop-hover' : ''}${spaceHeld || tool === 'pan' ? ' board-canvas--pan' : ''}`}
      style={{ background: document.background }}
      onPointerDown={onViewportPointerDown}
      onPointerMove={(e) => {
        updateDropAt(e.clientX, e.clientY)
        onPointerMove(e)
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="board-world"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
          transformOrigin: '0 0'
        }}
      >
        {visibleItems.map((item) => (
          <BoardItemView
            key={item.id}
            item={item}
            selected={selection.includes(item.id)}
            camera={camera}
            getViewportRect={getRect}
            onPointerDown={(e) => onItemPointerDown(item, e)}
          />
        ))}
      </div>
      {marquee && (
        <div
          className="board-marquee"
          style={{
            left: Math.min(marquee.x1, marquee.x2),
            top: Math.min(marquee.y1, marquee.y2),
            width: Math.abs(marquee.x2 - marquee.x1),
            height: Math.abs(marquee.y2 - marquee.y1)
          }}
        />
      )}
    </div>
  )
}
