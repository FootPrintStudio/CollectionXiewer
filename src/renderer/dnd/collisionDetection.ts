import {
  pointerWithin,
  rectIntersection,
  type CollisionDetection
} from '@dnd-kit/core'

/** Prefer pointer hits; fall back to rectangle overlap (helps cross-panel gallery → library drops). */
export const galleryCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args)
  if (pointerHits.length > 0) return pointerHits
  return rectIntersection(args)
}
