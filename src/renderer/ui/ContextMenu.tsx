import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuItem {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    firstItemRef.current?.focus({ preventScroll: true })

    const onPointerDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [close])

  return createPortal(
    <div
      ref={ref}
      className="context-menu"
      style={{ left: x, top: y }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, index) => {
        const firstEnabledIndex = items.findIndex((i) => !i.disabled)
        return (
        <button
          key={item.label}
          ref={index === firstEnabledIndex ? firstItemRef : undefined}
          type="button"
          className={`context-menu__item${item.danger ? ' context-menu__item--danger' : ''}${item.disabled ? ' context-menu__item--disabled' : ''}`}
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return
            item.onClick()
            close()
          }}
        >
          {item.label}
        </button>
        )
      })}
    </div>,
    document.body
  )
}
