import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface SectionHelpProps {
  children: ReactNode
  /** Accessible name for the ? trigger */
  label?: string
}

interface PopupPosition {
  top: number
  left: number
}

/** Hover/focus popup help shown from a ? control beside a section label (portaled above all panels). */
export function SectionHelp({ children, label = 'Section help' }: SectionHelpProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<PopupPosition>({ top: 0, left: 0 })

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const gap = 6
    const popupMaxWidth = Math.min(272, window.innerWidth - 16)
    const half = popupMaxWidth / 2
    let left = rect.left + rect.width / 2
    left = Math.max(8 + half, Math.min(window.innerWidth - 8 - half, left))
    let top = rect.bottom + gap
    const estimatedHeight = 80
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - gap - estimatedHeight)
    }
    setPosition({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    const onLayout = () => updatePosition()
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    return () => {
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [open, updatePosition])

  const show = () => {
    updatePosition()
    setOpen(true)
  }

  const hide = () => setOpen(false)

  return (
    <>
      <span className="section-help">
        <button
          ref={triggerRef}
          type="button"
          className="section-help__trigger"
          aria-label={label}
          onMouseEnter={show}
          onMouseLeave={hide}
          onFocus={show}
          onBlur={hide}
        >
          ?
        </button>
      </span>
      {open
        ? createPortal(
            <div
              className="section-help__popup section-help__popup--fixed"
              style={{ top: position.top, left: position.left }}
              role="tooltip"
            >
              {children}
            </div>,
            document.body
          )
        : null}
    </>
  )
}
