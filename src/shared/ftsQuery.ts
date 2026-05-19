/** Build an FTS5 MATCH string (prefix terms, ANDed). */
export function buildFtsMatchQuery(raw: string): string | null {
  const terms = raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/"/g, '""'))
  if (terms.length === 0) return null
  return terms.map((t) => `"${t}"*`).join(' AND ')
}
