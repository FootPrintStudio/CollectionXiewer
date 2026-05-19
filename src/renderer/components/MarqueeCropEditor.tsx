import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { CropRect } from '../../shared/types'
import {
  clientToImagePoint,
  computeImageDisplayRect,
  cropToPixelRect,
  hitTestCrop,
  imagePointToNormalized,
  moveCrop,
  rectFromPoints,
  resizeCrop,
  type CropHandle
} from '../lib/cropEditorUtils'

interface Props {
  src: string
  mediaId: number
  onCropChange: (rect: CropRect | null) => void
}

type Interaction =
  | { kind: 'draw'; start: { x: number; y: number } }
  | { kind: 'move'; start: { x: number; y: number }; startCrop: CropRect }
  | {
      kind: 'resize'
      handle: CropHandle
      start: { x: number; y: number }
      startCrop: CropRect
    }

const HANDLE_CURSORS: Record<CropHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize'
}

const HANDLE_POSITIONS: { id: CropHandle; style: CSSProperties }[] = [
  { id: 'nw', style: { left: 0, top: 0, transform: 'translate(-50%, -50%)' } },
  { id: 'n', style: { left: '50%', top: 0, transform: 'translate(-50%, -50%)' } },
  { id: 'ne', style: { right: 0, top: 0, transform: 'translate(50%, -50%)' } },
  { id: 'e', style: { right: 0, top: '50%', transform: 'translate(50%, -50%)' } },
  { id: 'se', style: { right: 0, bottom: 0, transform: 'translate(50%, 50%)' } },
  { id: 's', style: { left: '50%', bottom: 0, transform: 'translate(-50%, 50%)' } },
  { id: 'sw', style: { left: 0, bottom: 0, transform: 'translate(-50%, 50%)' } },
  { id: 'w', style: { left: 0, top: '50%', transform: 'translate(-50%, -50%)' } }
]

export function MarqueeCropEditor({ src, mediaId, onCropChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  const [selection, setSelection] = useState<CropRect | null>(null)
  const interactionRef = useRef<Interaction | null>(null)
  const [cursor, setCursor] = useState('crosshair')

  useEffect(() => {
    const img = new Image()
    img.src = src
    const onLoad = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.addEventListener('load', onLoad)
    if (img.complete) onLoad()
    return () => img.removeEventListener('load', onLoad)
  }, [src])

  const onCropChangeRef = useRef(onCropChange)
  onCropChangeRef.current = onCropChange

  useEffect(() => {
    let cancelled = false
    void window.collectionXiewer.crop.get(mediaId).then((saved) => {
      if (cancelled) return
      if (saved) {
        const rect = { x: saved.x, y: saved.y, w: saved.w, h: saved.h }
        setSelection(rect)
        onCropChangeRef.current(rect)
      } else {
        setSelection(null)
        onCropChangeRef.current(null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [mediaId, src])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height
        })
      }
    })
    ro.observe(el)
    setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const display = useMemo(
    () => computeImageDisplayRect(containerSize.w, containerSize.h, naturalSize.w, naturalSize.h),
    [containerSize, naturalSize]
  )

  const updateSelection = useCallback(
    (rect: CropRect | null) => {
      setSelection(rect)
      onCropChange(rect)
    },
    [onCropChange]
  )

  const getContainerRect = () => containerRef.current!.getBoundingClientRect()

  const onPointerDown = (e: React.PointerEvent) => {
    if (!display || e.button !== 0) return
    const containerRect = getContainerRect()
    const hit = hitTestCrop(e.clientX, e.clientY, containerRect, display, selection)
    const start = clientToImagePoint(e.clientX, e.clientY, containerRect, display)

    if (hit === 'draw') {
      interactionRef.current = { kind: 'draw', start }
      updateSelection(rectFromPoints(start, start, display))
      setCursor('crosshair')
    } else if (hit === 'move' && selection) {
      interactionRef.current = { kind: 'move', start, startCrop: selection }
      setCursor('move')
    } else {
      const handle = hit as CropHandle
      interactionRef.current = {
        kind: 'resize',
        handle,
        start,
        startCrop: selection!
      }
      setCursor(HANDLE_CURSORS[handle])
    }

    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!display) return
    const containerRect = getContainerRect()
    const current = clientToImagePoint(e.clientX, e.clientY, containerRect, display)
    const interaction = interactionRef.current

    if (!interaction) {
      const hit = hitTestCrop(e.clientX, e.clientY, containerRect, display, selection)
      if (hit === 'draw') setCursor(selection ? 'crosshair' : 'crosshair')
      else if (hit === 'move') setCursor('move')
      else setCursor(HANDLE_CURSORS[hit])
      return
    }

    if (interaction.kind === 'draw') {
      updateSelection(rectFromPoints(interaction.start, current, display))
    } else if (interaction.kind === 'move') {
      const startNorm = imagePointToNormalized(interaction.start.x, interaction.start.y, display)
      const curNorm = imagePointToNormalized(current.x, current.y, display)
      updateSelection(
        moveCrop(interaction.startCrop, curNorm.x - startNorm.x, curNorm.y - startNorm.y)
      )
    } else {
      updateSelection(
        resizeCrop(interaction.startCrop, interaction.handle, current, interaction.start, display)
      )
    }
  }

  const endInteraction = (e: React.PointerEvent) => {
    if (!interactionRef.current) return
    interactionRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const selectionPx = display && selection ? cropToPixelRect(selection, display) : null

  return (
    <div
      ref={containerRef}
      className="marquee-crop"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
    >
      <img className="marquee-crop__image" src={src} alt="" draggable={false} />
      {display ? (
        <div
          className="marquee-crop__overlay"
          style={{
            left: display.x,
            top: display.y,
            width: display.w,
            height: display.h
          }}
        >
          {!selection ? (
            <p className="marquee-crop__hint">Drag on the image to draw a crop area</p>
          ) : null}
          {selectionPx ? (
            <div
              className="marquee-crop__selection"
              style={{
                left: selectionPx.left - display.x,
                top: selectionPx.top - display.y,
                width: selectionPx.width,
                height: selectionPx.height
              }}
            >
              {HANDLE_POSITIONS.map(({ id, style }) => (
                <span
                  key={id}
                  className={`marquee-crop__handle marquee-crop__handle--${id}`}
                  style={style}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
