import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_SCALE = 0.25
const MAX_SCALE = 8
const ZOOM_STEP = 0.12

interface Props {
  src: string
  alt?: string
}

export function ZoomablePreviewImage({ src, alt = '' }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({ active: false, startX: 0, startY: 0, panX: 0, panY: 0 })

  useEffect(() => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }, [src])

  const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP
    setScale((s) => clampScale(s * factor))
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y
    }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return
    setPan({
      x: dragRef.current.panX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.panY + (e.clientY - dragRef.current.startY)
    })
  }

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return
    dragRef.current.active = false
    setDragging(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div
      ref={viewportRef}
      className={`previewer-zoom-viewport${dragging ? ' previewer-zoom-viewport--dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="previewer-zoom-layer"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
      >
        <img src={src} alt={alt} draggable={false} />
      </div>
    </div>
  )
}
