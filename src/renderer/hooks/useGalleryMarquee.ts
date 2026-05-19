import { useCallback, useRef, useState, type RefObject } from 'react'
import { rectsIntersect } from '../lib/mediaSelection'

export interface MarqueeRect {
  left: number
  top: number
  width: number
  height: number
}

interface Point {
  x: number
  y: number
}

function clientMarqueeFromPoints(start: Point, end: Point) {
  const left = Math.min(start.x, end.x)
  const top = Math.min(start.y, end.y)
  const right = Math.max(start.x, end.x)
  const bottom = Math.max(start.y, end.y)
  return { left, top, right, bottom }
}

function collectMarqueeHits(
  container: HTMLElement,
  marqueeClient: { left: number; top: number; right: number; bottom: number }
): number[] {
  const hits: number[] = []
  const cells = container.querySelectorAll<HTMLElement>('.thumb-cell[data-media-id]')
  for (const cell of cells) {
    const id = Number(cell.dataset.mediaId)
    if (!Number.isFinite(id)) continue
    const r = cell.getBoundingClientRect()
    if (
      rectsIntersect(marqueeClient, {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom
      })
    ) {
      hits.push(id)
    }
  }
  return hits
}

export function useGalleryMarquee(
  containerRef: RefObject<HTMLElement | null>,
  onSelect: (ids: number[], opts: { additive: boolean }) => void
) {
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null)
  const startRef = useRef<Point | null>(null)
  const additiveRef = useRef(false)

  const finish = useCallback(
    (end: Point) => {
      const start = startRef.current
      const container = containerRef.current
      startRef.current = null
      setMarquee(null)

      if (!start || !container) return

      const w = Math.abs(end.x - start.x)
      const h = Math.abs(end.y - start.y)
      if (w < 4 && h < 4) {
        onSelect([], { additive: false })
        return
      }

      const clientRect = clientMarqueeFromPoints(start, end)
      const hits = collectMarqueeHits(container, clientRect)
      onSelect(hits, { additive: additiveRef.current })
    },
    [containerRef, onSelect]
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest('.thumb-cell')) return

      const container = containerRef.current
      if (!container) return

      e.preventDefault()
      additiveRef.current = e.shiftKey || e.ctrlKey || e.metaKey
      const start = { x: e.clientX, y: e.clientY }
      startRef.current = start

      const containerRect = container.getBoundingClientRect()
      setMarquee({
        left: start.x - containerRect.left + container.scrollLeft,
        top: start.y - containerRect.top + container.scrollTop,
        width: 0,
        height: 0
      })

      const onMove = (ev: PointerEvent) => {
        const containerRect = container.getBoundingClientRect()
        const left = Math.min(start.x, ev.clientX) - containerRect.left + container.scrollLeft
        const top = Math.min(start.y, ev.clientY) - containerRect.top + container.scrollTop
        setMarquee({
          left,
          top,
          width: Math.abs(ev.clientX - start.x),
          height: Math.abs(ev.clientY - start.y)
        })
      }

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        finish({ x: ev.clientX, y: ev.clientY })
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [containerRef, finish]
  )

  return { marquee, onPointerDown }
}
