import type { AutoScrollOptions, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import { add, getEventCoordinates } from '@dnd-kit/utilities'

/** Only auto-scroll panels the pointer is actually over (avoids both sidebars scrolling). */
export function createPointerScopedAutoScroll() {
  let pointer: { x: number; y: number } | null = null

  const autoScroll: AutoScrollOptions = {
    canScroll(element) {
      if (!pointer) return true
      const rect = element.getBoundingClientRect()
      return (
        pointer.x >= rect.left &&
        pointer.x <= rect.right &&
        pointer.y >= rect.top &&
        pointer.y <= rect.bottom
      )
    }
  }

  function trackDragStart(event: DragStartEvent): void {
    const start = getEventCoordinates(event.activatorEvent)
    if (!start) return
    pointer = { x: start.x, y: start.y }
  }

  function trackDragMove(event: DragMoveEvent): void {
    const start = getEventCoordinates(event.activatorEvent)
    if (!start) return
    const next = add(start, event.delta)
    pointer = { x: next.x, y: next.y }
  }

  function clearPointer(): void {
    pointer = null
  }

  return { autoScroll, trackDragStart, trackDragMove, clearPointer }
}
