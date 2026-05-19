import { useCallback, useRef, useState } from 'react'

interface PanelResizeHandleProps {
  /** Panel grows when the pointer moves in this direction along X. */
  growDirection: 'left' | 'right'
  onResize: (widthDelta: number) => void
  onResizeEnd?: () => void
  ariaLabel?: string
}

export function PanelResizeHandle({
  growDirection,
  onResize,
  onResizeEnd,
  ariaLabel = 'Resize panel'
}: PanelResizeHandleProps) {
  const [active, setActive] = useState(false)
  const lastX = useRef(0)

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const handle = e.currentTarget
      handle.setPointerCapture(e.pointerId)
      lastX.current = e.clientX
      setActive(true)

      const onPointerMove = (ev: PointerEvent) => {
        const rawDelta = ev.clientX - lastX.current
        lastX.current = ev.clientX
        const widthDelta = growDirection === 'right' ? rawDelta : -rawDelta
        onResize(widthDelta)
      }

      const end = (ev: PointerEvent) => {
        if (handle.hasPointerCapture(ev.pointerId)) {
          handle.releasePointerCapture(ev.pointerId)
        }
        setActive(false)
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', end)
        window.removeEventListener('pointercancel', end)
        document.body.classList.remove('panel-resize-active')
        onResizeEnd?.()
      }

      document.body.classList.add('panel-resize-active')
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', end)
      window.addEventListener('pointercancel', end)
    },
    [growDirection, onResize, onResizeEnd]
  )

  return (
    <div
      className={`panel-resize-handle${active ? ' panel-resize-handle--active' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
    />
  )
}
