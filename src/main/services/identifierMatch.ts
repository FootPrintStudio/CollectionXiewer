import type { IdentifierBadge } from '../../shared/types'
import { parseSearchAst } from '../../shared/searchAst'
import { matchMediaIds } from './mediaQuery'
import { listIdentifiers } from './identifiers'
import { getTagGraphEpoch } from './appPrefs'

let cacheEpoch = -1
let cache: Map<number, number[]> | null = null

function matchSetsByIdentifier(): Map<number, number[]> {
  const epoch = getTagGraphEpoch()
  if (cache && cacheEpoch === epoch) return cache

  const next = new Map<number, number[]>()
  const identifiers = listIdentifiers().filter((i) => i.enabled)
  for (const ident of identifiers) {
    const ast = parseSearchAst(ident.query_ast)
    next.set(ident.id, matchMediaIds(ast))
  }
  cache = next
  cacheEpoch = epoch
  return next
}

export function invalidateIdentifierMatchCache(): void {
  cache = null
  cacheEpoch = -1
}

export function identifierBadgesForMediaIds(
  mediaIds: number[]
): Record<number, IdentifierBadge[]> {
  if (mediaIds.length === 0) return {}
  const idSet = new Set(mediaIds)
  const result: Record<number, IdentifierBadge[]> = {}
  for (const mid of mediaIds) result[mid] = []

  const matchSets = matchSetsByIdentifier()
  const identifiers = listIdentifiers().filter((i) => i.enabled)
  for (const ident of identifiers) {
    const matching = matchSets.get(ident.id) ?? []
    const badge: IdentifierBadge = {
      identifierId: ident.id,
      label: ident.label,
      icon: ident.icon,
      color: ident.color,
      query_text: ident.query_text
    }
    for (const mid of matching) {
      if (!idSet.has(mid)) continue
      result[mid]!.push(badge)
    }
  }
  return result
}
