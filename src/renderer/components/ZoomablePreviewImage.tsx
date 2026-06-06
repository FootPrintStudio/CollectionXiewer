import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  computePreviewImageGeometry,
  type PreviewImageGeometry
} from '../lib/previewImageGeometry'

const MIN_SCALE = 0.25
const MAX_SCALE = 8
const ZOOM_STEP = 0.12

interface Props {
  src: string
  alt?: string
  /** Indexed dimensions used until the image reports natural size. */
  layoutSize?: { w: number; h: number } | null
  onNaturalSize?: (size: { w: number; h: number } | null) => void
  /** Rendered above the image but outside the CSS zoom transform (for DnD hit targets). */
  regionOverlay?: (geometry: PreviewImageGeometry) => React.ReactNode
}

function fitScaleForViewport(
  viewportW: number,
  viewportH: number,
  imageW: number,
  imageH: number
): number {
  if (viewportW <= 0 || viewportH <= 0 || imageW <= 0 || imageH <= 0) return 1
  return Math.min(viewportW / imageW, viewportH / imageH, 1)
}

export function ZoomablePreviewImage({
  src,
  alt = '',
  layoutSize = null,
  onNaturalSize,
  regionOverlay
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [geometry, setGeometry] = useState<PreviewImageGeometry | null>(null)
  const dragRef = useRef({ active: false, startX: 0, startY: 0, panX: 0, panY: 0 })
  const onNaturalSizeRef = useRef(onNaturalSize)
  onNaturalSizeRef.current = onNaturalSize

  const applyNaturalFromImg = useCallback((img: HTMLImageElement) => {
    if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return
    const size = { w: img.naturalWidth, h: img.naturalHeight }
    setNatural(size)
    onNaturalSizeRef.current?.(size)
    setScale(1)
    setPan({ x: 0, y: 0 })
  }, [])

  useLayoutEffect(() => {
    setNatural(null)
    onNaturalSizeRef.current?.(null)
    setScale(1)
    setPan({ x: 0, y: 0 })

    const img = imgRef.current
    if (img?.complete) applyNaturalFromImg(img)
  }, [src, applyNaturalFromImg])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const sync = () => {
      const r = el.getBoundingClientRect()
      setViewport({ w: r.width, h: r.height })
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const contentSize = natural ?? layoutSize
  const baseFit =
    contentSize != null
      ? fitScaleForViewport(viewport.w, viewport.h, contentSize.w, contentSize.h)
      : 1
  const totalScale = baseFit * scale

  useLayoutEffect(() => {
    if (!contentSize) {
      setGeometry(null)
      return
    }
    setGeometry(
      computePreviewImageGeometry(
        viewport.w,
        viewport.h,
        contentSize.w,
        contentSize.h,
        totalScale,
        pan.x,
        pan.y
      )
    )
  }, [contentSize, viewport.w, viewport.h, totalScale, pan.x, pan.y])

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

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    applyNaturalFromImg(e.currentTarget)
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
        style={{
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${totalScale})`
        }}
      >
        <div
          className="previewer-zoom-content"
          style={
            contentSize
              ? { position: 'relative', width: contentSize.w, height: contentSize.h }
              : undefined
          }
        >
          <img
            ref={imgRef}
            key={src}
            src={src}
            alt={alt}
            draggable={false}
            width={contentSize?.w}
            height={contentSize?.h}
            onLoad={onImageLoad}
          />
        </div>
      </div>
      {geometry && regionOverlay ? (
        <div className="subject-region-viewport-layer">{regionOverlay(geometry)}</div>
      ) : null}
    </div>
  )
}
