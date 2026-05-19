/** True when two axis-aligned rectangles overlap (client/viewport coordinates). */
export function rectsIntersect(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number }
): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)
}

/** Inclusive index range between two positions in an ordered id list. */
export function rangeBetweenIds(
  orderedIds: number[],
  anchorId: number,
  targetId: number
): number[] {
  const a = orderedIds.indexOf(anchorId)
  const b = orderedIds.indexOf(targetId)
  if (a < 0 || b < 0) return [targetId]
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return orderedIds.slice(lo, hi + 1)
}

export function toggleIdInList(ids: number[], id: number): number[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id)
  return [...ids, id]
}
