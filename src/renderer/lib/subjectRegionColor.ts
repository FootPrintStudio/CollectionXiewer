function hashSubjectId(id: number): number {
  let h = id >>> 0
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) >>> 0
}

/** Stable vivid border color per subject (varies like random assignment). */
export function subjectRegionBorderColor(subjectId: number): string {
  const h = hashSubjectId(subjectId)
  const hue = h % 360
  const sat = 72 + (h % 18)
  const light = 52 + ((h >>> 8) % 14)
  return `hsl(${hue} ${sat}% ${light}%)`
}
