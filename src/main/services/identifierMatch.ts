import type { IdentifierBadge } from '../../shared/types'
import { parseSearchAst } from '../../shared/searchAst'
import { matchMediaIds } from './mediaQuery'
import { listIdentifiers } from './identifiers'

export function identifierBadgesForMediaIds(
  mediaIds: number[]
): Record<number, IdentifierBadge[]> {
  if (mediaIds.length === 0) return {}
  const idSet = new Set(mediaIds)
  const result: Record<number, IdentifierBadge[]> = {}
  for (const mid of mediaIds) result[mid] = []

  const identifiers = listIdentifiers().filter((i) => i.enabled)
  for (const ident of identifiers) {
    const ast = parseSearchAst(ident.query_ast)
    const matching = matchMediaIds(ast)
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
