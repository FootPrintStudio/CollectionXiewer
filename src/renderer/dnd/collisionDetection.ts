import {
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type Collision
} from '@dnd-kit/core'
import { PREVIEW_SUBJECT_DROP_PREFIX, SUBJECT_DROP_PREFIX } from './tagDnd'

function preferSubjectRegionHits(hits: Collision[]): Collision[] {
  if (hits.length <= 1) return hits
  const previewHits = hits.filter((h) => String(h.id).startsWith(PREVIEW_SUBJECT_DROP_PREFIX))
  if (previewHits.length > 0) return previewHits
  const sidebarHits = hits.filter((h) => String(h.id).startsWith(SUBJECT_DROP_PREFIX))
  return sidebarHits.length > 0 ? sidebarHits : hits
}

/** Prefer pointer hits; fall back to rectangle overlap (helps cross-panel gallery → library drops). */
export const galleryCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args)
  if (pointerHits.length > 0) return preferSubjectRegionHits(pointerHits)
  const rectHits = rectIntersection(args)
  return preferSubjectRegionHits(rectHits)
}
