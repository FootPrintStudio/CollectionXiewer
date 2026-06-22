import { getDb } from '../db/database'
import type { MediaItem, MediaListQuery, MediaSortOrder } from '../../shared/types'
import { mediaSortOrderClause } from '../../shared/mediaSort'
import { enrichMedia, enrichMediaWithCrop } from './mediaPaths'
import { searchMediaWikiFts } from './wikiFts'
import type { SearchNode } from '../../shared/searchAst'

export interface SearchOptions {
  sortOrder?: MediaSortOrder
}

type TagClause = Extract<SearchNode, { type: 'tag' }>
type SuggestedClause = Extract<SearchNode, { type: 'suggestedTag' }>

export function listMedia(query: MediaListQuery = {}): MediaItem[] {
  const db = getDb()
  const conditions: string[] = ['m.missing = 0']
  const params: unknown[] = []

  if (query.rootId) {
    conditions.push('m.root_id = ?')
    params.push(query.rootId)
  }

  if (query.collectionId) {
    conditions.push(
      `m.id IN (SELECT media_id FROM collection_members WHERE collection_id = ?)`
    )
    params.push(query.collectionId)
  }

  if (query.kinds?.length) {
    conditions.push(`m.kind IN (${query.kinds.map(() => '?').join(',')})`)
    params.push(...query.kinds)
  }

  if (query.tagIds?.length) {
    const mode = query.tagMode ?? 'any'
    if (mode === 'all') {
      for (const tid of query.tagIds) {
        conditions.push(
          `m.id IN (
            SELECT mt.media_id FROM media_tags mt
            LEFT JOIN tag_closure tc ON tc.descendant_id = mt.tag_id
            WHERE mt.tag_id = ? OR tc.ancestor_id = ?
          )`
        )
        params.push(tid, tid)
      }
    } else {
      const placeholders = query.tagIds.map(() => '?').join(',')
      conditions.push(
        `m.id IN (
          SELECT DISTINCT mt.media_id FROM media_tags mt
          LEFT JOIN tag_closure tc ON tc.descendant_id = mt.tag_id
          WHERE mt.tag_id IN (${placeholders}) OR tc.ancestor_id IN (${placeholders})
        )`
      )
      params.push(...query.tagIds, ...query.tagIds)
    }
  }

  if (query.excludeTagIds?.length) {
    for (const tid of query.excludeTagIds) {
      conditions.push(
        `m.id NOT IN (
          SELECT mt.media_id FROM media_tags mt
          LEFT JOIN tag_closure tc ON tc.descendant_id = mt.tag_id
          WHERE mt.tag_id = ? OR tc.ancestor_id = ?
        )`
      )
      params.push(tid, tid)
    }
  }

  const limit = query.limit ?? 500
  const offset = query.offset ?? 0
  const orderBy = mediaSortOrderClause(query.sortOrder)

  const sql = `
    SELECT m.id, m.root_id, m.relative_path, m.mime, m.kind, m.width, m.height,
           m.duration_ms, m.mtime, m.indexed_at, m.missing, r.path AS root_path,
           c.x AS crop_x, c.y AS crop_y, c.w AS crop_w, c.h AS crop_h
    FROM media_items m
    JOIN watch_roots r ON r.id = m.root_id
    LEFT JOIN media_crop c ON c.media_id = m.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `
  params.push(limit, offset)

  const rows = db.prepare(sql).all(...params) as Array<
    Omit<MediaItem, 'absolute_path'> & {
      root_path: string
      crop_x?: number | null
      crop_y?: number | null
      crop_w?: number | null
      crop_h?: number | null
    }
  >
  return rows.map((r) => enrichMediaWithCrop(r))
}

export function getMedia(id: number): MediaItem | null {
  const row = getDb()
    .prepare(
      `SELECT m.*, r.path AS root_path,
              c.x AS crop_x, c.y AS crop_y, c.w AS crop_w, c.h AS crop_h
       FROM media_items m
       JOIN watch_roots r ON r.id = m.root_id
       LEFT JOIN media_crop c ON c.media_id = m.id
       WHERE m.id = ?`
    )
    .get(id) as
    | (Omit<MediaItem, 'absolute_path'> & {
        root_path: string
        crop_x?: number | null
        crop_y?: number | null
        crop_w?: number | null
        crop_h?: number | null
      })
    | undefined
  if (!row) return null
  return enrichMediaWithCrop(row)
}

export function runSearchAst(
  ast: SearchNode,
  limit = 500,
  offset = 0,
  options: SearchOptions = {}
): MediaItem[] {
  const ids = evalAst(ast, options)
  if (ids === null) return listMedia({ limit, offset, sortOrder: options.sortOrder })
  if (ids.length === 0) return []
  const orderBy = mediaSortOrderClause(options.sortOrder)
  const placeholders = ids.map(() => '?').join(',')
  const rows = getDb()
    .prepare(
      `SELECT m.*, r.path AS root_path,
              c.x AS crop_x, c.y AS crop_y, c.w AS crop_w, c.h AS crop_h
       FROM media_items m
       JOIN watch_roots r ON r.id = m.root_id
       LEFT JOIN media_crop c ON c.media_id = m.id
       WHERE m.id IN (${placeholders}) AND m.missing = 0
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .all(...ids, limit, offset) as Array<
      Omit<MediaItem, 'absolute_path'> & {
        root_path: string
        crop_x?: number | null
        crop_y?: number | null
        crop_w?: number | null
        crop_h?: number | null
      }
    >
  return rows.map((r) => enrichMediaWithCrop(r))
}

/** Media IDs matching a search AST (empty AND root = all non-missing media). */
export function matchMediaIds(ast: SearchNode, options: SearchOptions = {}): number[] {
  const ids = evalAst(ast, options)
  if (ids === null) return allMediaIds()
  return ids
}

function evalAst(node: SearchNode, options: SearchOptions): number[] | null {
  switch (node.type) {
    case 'and': {
      if (node.children.length === 0) return null
      return evalAnd(node.children, options)
    }
    case 'or': {
      const union = new Set<number>()
      for (const child of node.children) {
        const ids = evalAst(child, options)
        if (ids) ids.forEach((id) => union.add(id))
      }
      return [...union]
    }
    case 'not': {
      const all = new Set(allMediaIds())
      const ids = evalAst(node.child, options)
      if (!ids) return [...all]
      ids.forEach((id) => all.delete(id))
      return [...all]
    }
    case 'tag':
      if (node.subjectGroup != null) {
        return mediaIdsForSubjectGroup([node], [])
      }
      return mediaIdsForTag(node.tagId, node.include)
    case 'suggestedTag':
      if (node.subjectGroup != null) {
        return mediaIdsForSubjectGroup([], [node])
      }
      return mediaIdsForSuggestedTag(node.tagId, node.include)
    case 'collection':
      return mediaIdsForCollection(node.collectionId)
    case 'kind':
      return mediaIdsForKind(node.kind)
    case 'principalTag':
      return mediaIdsForPrincipalTag(node.tagId)
    case 'wiki':
      return mediaIdsForWiki(node.query)
    case 'wikiEmpty':
      return mediaIdsForWikiEmpty()
    case 'untagged':
      return mediaIdsForUntagged()
    case 'path':
      return mediaIdsForPath(node.pattern, node.mode)
    case 'folder':
      return mediaIdsForFolder(node.rootId, node.pathPrefix)
    default:
      return []
  }
}

function evalAnd(children: SearchNode[], options: SearchOptions): number[] {
  const loose: SearchNode[] = []
  const groups = new Map<
    number,
    { tags: TagClause[]; suggested: SuggestedClause[] }
  >()

  for (const child of children) {
    if (child.type === 'tag' && child.subjectGroup != null) {
      const g = groups.get(child.subjectGroup) ?? { tags: [], suggested: [] }
      g.tags.push(child)
      groups.set(child.subjectGroup, g)
    } else if (child.type === 'suggestedTag' && child.subjectGroup != null) {
      const g = groups.get(child.subjectGroup) ?? { tags: [], suggested: [] }
      g.suggested.push(child)
      groups.set(child.subjectGroup, g)
    } else {
      loose.push(child)
    }
  }

  let set: Set<number> | null = null

  for (const [, group] of groups) {
    const ids = mediaIdsForSubjectGroup(group.tags, group.suggested)
    const s = new Set(ids)
    if (set === null) set = s
    else set = intersectSets(set, s)
  }

  const looseTags = loose.filter((c): c is TagClause => c.type === 'tag')
  const looseSuggested = loose.filter((c): c is SuggestedClause => c.type === 'suggestedTag')
  const looseOther = loose.filter((c) => c.type !== 'tag' && c.type !== 'suggestedTag')

  if (looseTags.length > 0 || looseSuggested.length > 0) {
    const s = new Set(evalLooseTagClauses(looseTags, looseSuggested))
    if (set === null) set = s
    else set = intersectSets(set, s)
  }

  for (const child of looseOther) {
    const ids = evalAst(child, options)
    if (ids === null) continue
    const s = new Set(ids)
    if (set === null) set = s
    else set = intersectSets(set, s)
  }

  return set ? [...set] : []
}

/** Loose tag/suggested clauses in one AND: inclusive matches win over exclusive ancestors. */
function evalLooseTagClauses(tags: TagClause[], suggested: SuggestedClause[]): number[] {
  const includeTags = tags.filter((t) => t.include)
  const excludeTags = tags.filter((t) => !t.include)
  const includeSuggested = suggested.filter((t) => t.include)
  const excludeSuggested = suggested.filter((t) => !t.include)

  let result: Set<number> | null = null

  for (const t of includeTags) {
    const s = new Set(mediaIdsForTag(t.tagId, true))
    result = result === null ? s : intersectSets(result, s)
  }
  for (const t of includeSuggested) {
    const s = new Set(mediaIdsForSuggestedTag(t.tagId, true))
    result = result === null ? s : intersectSets(result, s)
  }

  const hasInclude = includeTags.length + includeSuggested.length > 0
  const hasExclude = excludeTags.length + excludeSuggested.length > 0

  if (!hasInclude && !hasExclude) return []

  if (!hasInclude) {
    let all = new Set(allMediaIds())
    for (const t of excludeTags) {
      for (const id of mediaIdsForTag(t.tagId, true)) all.delete(id)
    }
    for (const t of excludeSuggested) {
      for (const id of mediaIdsForSuggestedTag(t.tagId, true)) all.delete(id)
    }
    return [...all]
  }

  if (result === null) result = new Set<number>()

  const includeTagIds = includeTags.map((t) => t.tagId)
  const includeSuggestedIds = includeSuggested.map((t) => t.tagId)

  for (const t of excludeTags) {
    applyExclusiveTagWithPriority(result, t.tagId, includeTagIds)
  }
  for (const t of excludeSuggested) {
    applyExclusiveSuggestedWithPriority(result, t.tagId, includeSuggestedIds)
  }

  return [...result]
}

function applyExclusiveTagWithPriority(
  result: Set<number>,
  excludeTagId: number,
  inclusiveTagIds: number[]
): void {
  for (const id of mediaIdsForTag(excludeTagId, true)) {
    if (!result.has(id)) continue
    if (isProtectedFromExclusiveTag(id, excludeTagId, inclusiveTagIds)) continue
    result.delete(id)
  }
}

function applyExclusiveSuggestedWithPriority(
  result: Set<number>,
  excludeTagId: number,
  inclusiveSuggestedIds: number[]
): void {
  for (const id of mediaIdsForSuggestedTag(excludeTagId, true)) {
    if (!result.has(id)) continue
    if (isProtectedFromExclusiveSuggested(id, excludeTagId, inclusiveSuggestedIds)) continue
    result.delete(id)
  }
}

function allowedTagIdsFromInclusive(inclusiveTagIds: number[]): Set<number> {
  const allowed = new Set(inclusiveTagIds)
  if (inclusiveTagIds.length === 0) return allowed
  const db = getDb()
  const placeholders = inclusiveTagIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT descendant_id FROM tag_closure WHERE ancestor_id IN (${placeholders})`
    )
    .all(...inclusiveTagIds) as { descendant_id: number }[]
  for (const r of rows) allowed.add(r.descendant_id)
  return allowed
}

function appliedTagIdsOnMedia(mediaId: number): number[] {
  return (
    getDb()
      .prepare(`SELECT tag_id FROM media_tags WHERE media_id = ?`)
      .all(mediaId) as { tag_id: number }[]
  ).map((r) => r.tag_id)
}

function appliedSuggestedTagIdsOnMedia(mediaId: number): number[] {
  return (
    getDb()
      .prepare(`SELECT tag_id FROM media_tag_suggestions WHERE media_id = ?`)
      .all(mediaId) as { tag_id: number }[]
  ).map((r) => r.tag_id)
}

function tagsInAncestorSubtree(appliedTagIds: number[], ancestorTagId: number): Set<number> {
  const inSubtree = new Set<number>()
  const db = getDb()
  const hasAncestor = db.prepare(
    `SELECT 1 FROM tag_closure WHERE descendant_id = ? AND ancestor_id = ?`
  )
  for (const tid of appliedTagIds) {
    if (tid === ancestorTagId || hasAncestor.get(tid, ancestorTagId)) {
      inSubtree.add(tid)
    }
  }
  return inSubtree
}

function isProtectedFromExclusiveTag(
  mediaId: number,
  excludeTagId: number,
  inclusiveTagIds: number[]
): boolean {
  if (inclusiveTagIds.length === 0) return false
  const subtree = tagsInAncestorSubtree(appliedTagIdsOnMedia(mediaId), excludeTagId)
  if (subtree.size === 0) return false
  const allowed = allowedTagIdsFromInclusive(inclusiveTagIds)
  for (const tid of subtree) {
    if (!allowed.has(tid)) return false
  }
  return true
}

function isProtectedFromExclusiveSuggested(
  mediaId: number,
  excludeTagId: number,
  inclusiveSuggestedIds: number[]
): boolean {
  if (inclusiveSuggestedIds.length === 0) return false
  const subtree = tagsInAncestorSubtree(appliedSuggestedTagIdsOnMedia(mediaId), excludeTagId)
  if (subtree.size === 0) return false
  const allowed = allowedTagIdsFromInclusive(inclusiveSuggestedIds)
  for (const tid of subtree) {
    if (!allowed.has(tid)) return false
  }
  return true
}

function intersectSets(a: Set<number>, b: Set<number>): Set<number> {
  const out = new Set<number>()
  for (const id of a) {
    if (b.has(id)) out.add(id)
  }
  return out
}

function mediaIdsForSubjectGroup(tags: TagClause[], suggested: SuggestedClause[]): number[] {
  const includeTagIds = tags.filter((t) => t.include).map((t) => t.tagId)
  const excludeTagIds = tags.filter((t) => !t.include).map((t) => t.tagId)
  const includeSuggestedIds = suggested.filter((t) => t.include).map((t) => t.tagId)
  const excludeSuggestedIds = suggested.filter((t) => !t.include).map((t) => t.tagId)

  if (
    includeTagIds.length === 0 &&
    excludeTagIds.length === 0 &&
    includeSuggestedIds.length === 0 &&
    excludeSuggestedIds.length === 0
  ) {
    return []
  }

  if (
    includeTagIds.length === 0 &&
    includeSuggestedIds.length === 0 &&
    (excludeTagIds.length > 0 || excludeSuggestedIds.length > 0)
  ) {
    const all = new Set(allMediaIds())
    for (const tid of excludeTagIds) {
      mediaIdsWithTagOnAnySubject(tid).forEach((id) => all.delete(id))
    }
    for (const tid of excludeSuggestedIds) {
      mediaIdsWithSuggestedOnAnySubject(tid).forEach((id) => all.delete(id))
    }
    return [...all]
  }

  return mediaIdsMatchingSubjectConstraints(
    includeTagIds,
    excludeTagIds,
    includeSuggestedIds,
    excludeSuggestedIds
  )
}

function mediaIdsMatchingSubjectConstraints(
  includeTagIds: number[],
  excludeTagIds: number[],
  includeSuggestedIds: number[],
  excludeSuggestedIds: number[]
): number[] {
  const db = getDb()
  const parts: string[] = []
  const params: unknown[] = []

  const addTagUnion = (tagIds: number[], alias: string) => {
    for (const tid of tagIds) {
      parts.push(`
        SELECT mt.media_id, mt.subject_id, '${alias}' AS kind, ? AS qid
        FROM media_tags mt
        LEFT JOIN tag_closure tc ON tc.descendant_id = mt.tag_id
        JOIN media_items m ON m.id = mt.media_id AND m.missing = 0
        WHERE mt.subject_id IS NOT NULL
          AND (mt.tag_id = ? OR tc.ancestor_id = ?)
      `)
      params.push(tid, tid, tid)
    }
  }

  const addSuggestedUnion = (tagIds: number[], alias: string) => {
    for (const tid of tagIds) {
      parts.push(`
        SELECT mts.media_id, mts.subject_id, '${alias}' AS kind, ? AS qid
        FROM media_tag_suggestions mts
        JOIN media_items m ON m.id = mts.media_id AND m.missing = 0
        WHERE mts.tag_id = ?
      `)
      params.push(tid, tid)
    }
  }

  addTagUnion(includeTagIds, 'inc_tag')
  addSuggestedUnion(includeSuggestedIds, 'inc_sug')

  if (parts.length === 0) return []

  const sql = `
    SELECT media_id, subject_id FROM (
      SELECT media_id, subject_id,
        COUNT(DISTINCT CASE WHEN kind = 'inc_tag' THEN qid END) AS inc_tags,
        COUNT(DISTINCT CASE WHEN kind = 'inc_sug' THEN qid END) AS inc_sug
      FROM (${parts.join(' UNION ALL ')})
      GROUP BY media_id, subject_id
      HAVING inc_tags = ? AND inc_sug = ?
    )
  `

  params.push(includeTagIds.length, includeSuggestedIds.length)

  const rows = db.prepare(sql).all(...params) as { media_id: number; subject_id: number }[]
  const allowedTags = allowedTagIdsFromInclusive(includeTagIds)
  const allowedSuggested = allowedTagIdsFromInclusive(includeSuggestedIds)
  const mediaIds = new Set<number>()

  for (const row of rows) {
    const tagIds = subjectAppliedTagIds(row.media_id, row.subject_id)
    const sugIds = subjectAppliedSuggestedTagIds(row.media_id, row.subject_id)
    if (subjectViolatesTagExcludes(tagIds, excludeTagIds, allowedTags)) continue
    if (subjectViolatesTagExcludes(sugIds, excludeSuggestedIds, allowedSuggested)) continue
    mediaIds.add(row.media_id)
  }

  return [...mediaIds]
}

function subjectAppliedTagIds(mediaId: number, subjectId: number): number[] {
  return (
    getDb()
      .prepare(`SELECT tag_id FROM media_tags WHERE media_id = ? AND subject_id = ?`)
      .all(mediaId, subjectId) as { tag_id: number }[]
  ).map((r) => r.tag_id)
}

function subjectAppliedSuggestedTagIds(mediaId: number, subjectId: number): number[] {
  return (
    getDb()
      .prepare(`SELECT tag_id FROM media_tag_suggestions WHERE media_id = ? AND subject_id = ?`)
      .all(mediaId, subjectId) as { tag_id: number }[]
  ).map((r) => r.tag_id)
}

function subjectViolatesTagExcludes(
  appliedTagIds: number[],
  excludeTagIds: number[],
  allowed: Set<number>
): boolean {
  for (const ex of excludeTagIds) {
    const subtree = tagsInAncestorSubtree(appliedTagIds, ex)
    for (const tid of subtree) {
      if (!allowed.has(tid)) return true
    }
  }
  return false
}

/** Media where every tagId is present on the same subject_id row set. */
export function mediaIdsWithAllTagsInSameSubject(tagIds: number[]): number[] {
  if (tagIds.length === 0) return []
  if (tagIds.length === 1) return mediaIdsForTag(tagIds[0], true)

  const db = getDb()
  const unions: string[] = []
  const params: unknown[] = []

  for (const tid of tagIds) {
    unions.push(`
      SELECT mt.media_id, mt.subject_id, ? AS qtag
      FROM media_tags mt
      LEFT JOIN tag_closure tc ON tc.descendant_id = mt.tag_id
      JOIN media_items m ON m.id = mt.media_id AND m.missing = 0
      WHERE mt.subject_id IS NOT NULL
        AND (mt.tag_id = ? OR tc.ancestor_id = ?)
    `)
    params.push(tid, tid, tid)
  }

  const sql = `
    SELECT media_id FROM (
      SELECT media_id, subject_id, COUNT(DISTINCT qtag) AS n
      FROM (${unions.join(' UNION ALL ')})
      GROUP BY media_id, subject_id
      HAVING n = ?
    )
    GROUP BY media_id
  `
  params.push(tagIds.length)

  return (db.prepare(sql).all(...params) as { media_id: number }[]).map((r) => r.media_id)
}

function mediaIdsWithTagOnAnySubject(tagId: number): number[] {
  return (
    getDb()
      .prepare(
        `SELECT DISTINCT mt.media_id AS id FROM media_tags mt
         LEFT JOIN tag_closure tc ON tc.descendant_id = mt.tag_id
         JOIN media_items m ON m.id = mt.media_id AND m.missing = 0
         WHERE mt.subject_id IS NOT NULL
           AND (mt.tag_id = ? OR tc.ancestor_id = ?)`
      )
      .all(tagId, tagId) as { id: number }[]
  ).map((r) => r.id)
}

function mediaIdsWithSuggestedOnAnySubject(tagId: number): number[] {
  return (
    getDb()
      .prepare(
        `SELECT DISTINCT mts.media_id AS id FROM media_tag_suggestions mts
         JOIN media_items m ON m.id = mts.media_id AND m.missing = 0
         WHERE mts.tag_id = ?`
      )
      .all(tagId) as { id: number }[]
  ).map((r) => r.id)
}

function allMediaIds(): number[] {
  return (getDb().prepare(`SELECT id FROM media_items WHERE missing = 0`).all() as { id: number }[]).map(
    (r) => r.id
  )
}

function mediaIdsForTag(tagId: number, include: boolean): number[] {
  const ids = (
    getDb()
      .prepare(
        `SELECT DISTINCT m.id FROM media_items m
         JOIN media_tags mt ON mt.media_id = m.id
         LEFT JOIN tag_closure tc ON tc.descendant_id = mt.tag_id
         WHERE (mt.tag_id = ? OR tc.ancestor_id = ?) AND m.missing = 0`
      )
      .all(tagId, tagId) as { id: number }[]
  ).map((r) => r.id)
  if (include) return ids
  const all = new Set(allMediaIds())
  ids.forEach((id) => all.delete(id))
  return [...all]
}

function mediaIdsForSuggestedTag(tagId: number, include: boolean): number[] {
  const ids = (
    getDb()
      .prepare(
        `SELECT DISTINCT m.id FROM media_items m
         JOIN media_tag_suggestions mts ON mts.media_id = m.id
         WHERE mts.tag_id = ? AND m.missing = 0`
      )
      .all(tagId) as { id: number }[]
  ).map((r) => r.id)
  if (include) return ids
  const all = new Set(allMediaIds())
  ids.forEach((id) => all.delete(id))
  return [...all]
}

function mediaIdsForCollection(collectionId: number): number[] {
  return (
    getDb()
      .prepare(`SELECT media_id FROM collection_members WHERE collection_id = ?`)
      .all(collectionId) as { media_id: number }[]
  ).map((r) => r.media_id)
}

function mediaIdsForKind(kind: string): number[] {
  return (
    getDb()
      .prepare(`SELECT id FROM media_items WHERE kind = ? AND missing = 0`)
      .all(kind) as { id: number }[]
  ).map((r) => r.id)
}

function mediaIdsForPrincipalTag(tagId: number): number[] {
  return (
    getDb()
      .prepare(
        `SELECT DISTINCT cm.media_id AS id FROM collection_members cm
         JOIN collection_principal_tags cpt ON cpt.collection_id = cm.collection_id
         WHERE cpt.tag_id = ?`
      )
      .all(tagId) as { id: number }[]
  ).map((r) => r.id)
}

function mediaIdsForWiki(query: string): number[] {
  return searchMediaWikiFts(query)
}

function mediaIdsForWikiEmpty(): number[] {
  return (
    getDb()
      .prepare(
        `SELECT m.id FROM media_items m
         WHERE m.missing = 0
           AND NOT EXISTS (
             SELECT 1 FROM wiki_pages w
             WHERE w.entity_type = 'media' AND w.entity_id = m.id AND trim(w.body_md) != ''
           )`
      )
      .all() as { id: number }[]
  ).map((r) => r.id)
}

function mediaIdsForUntagged(): number[] {
  return (
    getDb()
      .prepare(
        `SELECT m.id FROM media_items m
         WHERE m.missing = 0
           AND NOT EXISTS (SELECT 1 FROM media_tags mt WHERE mt.media_id = m.id)`
      )
      .all() as { id: number }[]
  ).map((r) => r.id)
}

function mediaIdsForPath(pattern: string, mode: 'substring' | 'glob'): number[] {
  const db = getDb()
  if (mode === 'glob') {
    const like = pattern.replace(/[\\%_]/g, '\\$&').replace(/\*/g, '%').replace(/\?/g, '_')
    return (
      db
        .prepare(
          `SELECT id FROM media_items WHERE missing = 0 AND relative_path LIKE ? ESCAPE '\\'`
        )
        .all(like) as { id: number }[]
    ).map((r) => r.id)
  }
  return (
    db
      .prepare(`SELECT id FROM media_items WHERE missing = 0 AND relative_path LIKE ?`)
      .all(`%${pattern}%`) as { id: number }[]
  ).map((r) => r.id)
}

function mediaIdsForFolder(rootId?: number, pathPrefix?: string): number[] {
  const db = getDb()
  if (rootId != null && pathPrefix) {
    const root = db.prepare(`SELECT path FROM watch_roots WHERE id = ?`).get(rootId) as
      | { path: string }
      | undefined
    if (!root) return []
    const normRoot = root.path.replace(/\\/g, '/').replace(/\/+$/, '')
    const normPrefix = pathPrefix.replace(/\\/g, '/')
    const rel =
      normPrefix === normRoot
        ? ''
        : normPrefix.startsWith(normRoot + '/')
          ? normPrefix.slice(normRoot.length + 1)
          : null
    if (rel === null) {
      return (
        db.prepare(`SELECT id FROM media_items WHERE root_id = ? AND missing = 0`).all(rootId) as {
          id: number
        }[]
      ).map((r) => r.id)
    }
    if (rel === '') {
      return (
        db.prepare(`SELECT id FROM media_items WHERE root_id = ? AND missing = 0`).all(rootId) as {
          id: number
        }[]
      ).map((r) => r.id)
    }
    return (
      db
        .prepare(
          `SELECT id FROM media_items WHERE root_id = ? AND missing = 0
           AND (relative_path = ? OR relative_path LIKE ? ESCAPE '\\')`
        )
        .all(rootId, rel, `${rel.replace(/[\\%_]/g, '\\$&')}/%`) as { id: number }[]
    ).map((r) => r.id)
  }
  if (rootId != null) {
    return (
      db.prepare(`SELECT id FROM media_items WHERE root_id = ? AND missing = 0`).all(rootId) as {
        id: number
      }[]
    ).map((r) => r.id)
  }
  return []
}
