export type SearchClauseKind =
  | 'tag'
  | 'suggested'
  | 'collection'
  | 'principal'
  | 'folder'
  | 'wiki'

export interface ActiveCompletion {
  clause: SearchClauseKind
  negated: boolean
  partial: string
  quoted: boolean
  replaceStart: number
  replaceEnd: number
}

const CLAUSE_RE =
  /(?:^|[\s(])(-)?(tag|suggested|collection|principal|folder|wiki):(?:"([^"]*)?|([^\s@()]*)?)$/i

export function detectActiveCompletion(text: string, cursor: number): ActiveCompletion | null {
  const head = text.slice(0, cursor)
  const m = head.match(CLAUSE_RE)
  if (!m) return null

  const clause = m[2]!.toLowerCase() as SearchClauseKind
  const quoted = m[3] !== undefined
  const partial = quoted ? m[3]! : (m[4] ?? '')
  const matchStart = head.length - m[0]!.length
  const clauseFragment = m[0]!
  const colonOffset = clauseFragment.indexOf(':')
  const valueStartInMatch = colonOffset + 1
  let replaceStart = matchStart + valueStartInMatch
  if (quoted && text[replaceStart] === '"') replaceStart++

  return {
    clause,
    negated: !!m[1],
    partial,
    quoted,
    replaceStart,
    replaceEnd: cursor
  }
}

export function applyCompletion(
  text: string,
  active: ActiveCompletion,
  value: string
): { text: string; cursor: number } {
  const before = text.slice(0, active.replaceStart)
  const after = text.slice(active.replaceEnd)

  if (active.clause === 'collection' || active.clause === 'folder') {
    const inserted = `"${value.replace(/"/g, '\\"')}"`
    const next = before + inserted + after
    return { text: next, cursor: before.length + inserted.length }
  }

  const inserted = value
  const next = before + inserted + after
  return { text: next, cursor: before.length + inserted.length }
}
