import type { Modifier } from '@dnd-kit/core'

/** Keeps the drag overlay centered on the pointer instead of the element's top-left. */
export const snapCenterToCursor: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  transform
}) => {
  if (
    draggingNodeRect &&
    activatorEvent &&
    'clientX' in activatorEvent &&
    'clientY' in activatorEvent
  ) {
    const e = activatorEvent as PointerEvent
    return {
      ...transform,
      x: transform.x + e.clientX - draggingNodeRect.left - draggingNodeRect.width / 2,
      y: transform.y + e.clientY - draggingNodeRect.top - draggingNodeRect.height / 2
    }
  }
  return transform
}
