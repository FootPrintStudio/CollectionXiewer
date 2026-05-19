export type SearchNode =
  | { type: 'and'; children: SearchNode[] }
  | { type: 'or'; children: SearchNode[] }
  | { type: 'not'; child: SearchNode }
  | { type: 'tag'; tagId: number; include: boolean; subjectGroup?: number }
  | { type: 'suggestedTag'; tagId: number; include: boolean; subjectGroup?: number }
  | { type: 'collection'; collectionId: number }
  | { type: 'kind'; kind: string }
  | { type: 'principalTag'; tagId: number }
  | { type: 'wiki'; query: string }
  | { type: 'wikiEmpty' }
  | { type: 'untagged' }
  | { type: 'path'; pattern: string; mode: 'substring' | 'glob' }
  | { type: 'folder'; rootId?: number; pathPrefix?: string }

export const defaultSearchAst: SearchNode = { type: 'and', children: [] }

export interface SavedSearchPayload {
  v: 2
  ast: SearchNode
  queryText: string
}

export function parseSavedSearchPayload(json: string): {
  queryText: string | null
  ast: SearchNode
} {
  try {
    const parsed = JSON.parse(json) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      'v' in parsed &&
      (parsed as SavedSearchPayload).v === 2 &&
      'ast' in parsed &&
      'queryText' in parsed
    ) {
      const p = parsed as SavedSearchPayload
      return { queryText: p.queryText, ast: p.ast }
    }
    const ast = parseSearchAst(json)
    return { queryText: null, ast }
  } catch {
    return { queryText: null, ast: defaultSearchAst }
  }
}

export function parseSearchAst(json: string | null | undefined): SearchNode {
  if (!json) return defaultSearchAst
  try {
    const parsed = JSON.parse(json) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      'v' in parsed &&
      (parsed as { v: number }).v === 2 &&
      'ast' in parsed
    ) {
      return (parsed as { ast: SearchNode }).ast
    }
    return parsed as SearchNode
  } catch {
    return defaultSearchAst
  }
}

export function isEmptySearchAst(ast: SearchNode): boolean {
  return ast.type === 'and' && ast.children.length === 0
}

export function countSearchClauses(ast: SearchNode): number {
  switch (ast.type) {
    case 'and':
    case 'or':
      return ast.children.reduce((n, c) => n + countSearchClauses(c), 0)
    case 'not':
      return countSearchClauses(ast.child)
    default:
      return 1
  }
}
