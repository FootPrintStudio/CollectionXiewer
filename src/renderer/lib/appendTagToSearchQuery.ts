import type { SearchNode } from '../../shared/searchAst'
import { parseSearchQuery, type SearchResolveContext } from '../../shared/searchParser'
import type { Tag } from '../../shared/types'

function astIncludesTag(node: SearchNode, tagId: number): boolean {
  switch (node.type) {
    case 'and':
    case 'or':
      return node.children.some((c) => astIncludesTag(c, tagId))
    case 'not':
      return astIncludesTag(node.child, tagId)
    case 'tag':
    case 'suggestedTag':
    case 'principalTag':
      return node.tagId === tagId
    default:
      return false
  }
}

/** Append `tag:slug` to a search query (AND). Returns null if parse fails. */
export function appendTagToSearchQuery(
  queryText: string,
  tag: Tag,
  ctx: SearchResolveContext
): { queryText: string; ast: SearchNode } | null {
  const trimmed = queryText.trim()
  if (trimmed) {
    const existing = parseSearchQuery(trimmed, ctx)
    if (existing.errors.length === 0 && astIncludesTag(existing.ast, tag.id)) {
      return { queryText: trimmed, ast: existing.ast }
    }
  }

  const clause = `tag:${tag.slug}`
  const nextText = trimmed ? `${trimmed} ${clause}` : clause
  const { ast, errors } = parseSearchQuery(nextText, ctx)
  if (errors.length > 0) return null
  return { queryText: nextText, ast }
}
