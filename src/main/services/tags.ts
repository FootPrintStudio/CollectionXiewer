import { getDb } from '../db/database'
import { bumpTagGraphEpoch, syncTagClosureEpoch } from './appPrefs'
import type { Tag, TagConnection, TagExternalLink, MediaTag, MediaTagSuggestion, SubjectUpdatePatch } from '../../shared/types'
import { validateCropRect } from '../../shared/cropRect'
import { canAssignTagToGroup, canReparentTag, getTagSiblings, isDescendantOf } from '../../shared/tagTree'
import { formatTagLabel, slugifyTag } from '../../shared/tagDisplay'
import { normalizeTagIcon } from '../../shared/tagIcon'
import { isUniversalSubjectLabel, UNIVERSAL_SUBJECT_LABEL } from '../../shared/subjects'

type TagRow = Omit<Tag, 'use_custom_color' | 'use_custom_icon'> & {
  use_custom_color: number
  use_custom_icon: number
}

function rowToTag(row: TagRow): Tag {
  return {
    ...row,
    use_custom_color: !!row.use_custom_color,
    use_custom_icon: !!row.use_custom_icon,
    icon: row.icon ? normalizeTagIcon(row.icon) : null
  }
}

/** Move a tag and every descendant into the same tag group; child parent_id links are preserved. */
function applyTagGroupToSubtree(rootTagId: number, tagGroupId: number | null): void {
  const db = getDb()
  const updateGroup = db.prepare(`UPDATE tags SET tag_group_id = ? WHERE id = ?`)
  const listChildren = db.prepare(`SELECT id FROM tags WHERE parent_id = ?`)
  const queue = [rootTagId]
  while (queue.length > 0) {
    const id = queue.shift()!
    updateGroup.run(tagGroupId, id)
    for (const row of listChildren.all(id) as { id: number }[]) {
      queue.push(row.id)
    }
  }
}

function nextSortOrderAmongSiblings(parentId: number | null, tagGroupId: number | null): number {
  const siblings = listTags().filter(
    (t) =>
      t.parent_id === parentId && (t.tag_group_id ?? null) === (tagGroupId ?? null)
  )
  if (siblings.length === 0) return 0
  return Math.max(...siblings.map((t) => t.sort_order)) + 1
}

export function listTags(): Tag[] {
  return (
    getDb()
      .prepare(`SELECT * FROM tags ORDER BY sort_order, display_name COLLATE NOCASE`)
      .all() as TagRow[]
  ).map(rowToTag)
}

export function moveTag(id: number, direction: 'up' | 'down'): void {
  const siblings = getTagSiblings(id, listTags())
  const idx = siblings.findIndex((t) => t.id === id)
  if (idx < 0) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= siblings.length) return

  const a = siblings[idx]!
  const b = siblings[swapIdx]!
  const db = getDb()
  const move = db.transaction(() => {
    db.prepare(`UPDATE tags SET sort_order = ? WHERE id = ?`).run(b.sort_order, a.id)
    db.prepare(`UPDATE tags SET sort_order = ? WHERE id = ?`).run(a.sort_order, b.id)
  })
  move()
}

function compareTagLabels(a: Tag, b: Tag): number {
  const byLabel = formatTagLabel(a).localeCompare(formatTagLabel(b), undefined, {
    sensitivity: 'base'
  })
  if (byLabel !== 0) return byLabel
  return a.id - b.id
}

function applyAlphabeticalSortOrders(items: Tag[]): void {
  if (items.length < 2) return
  const sorted = [...items].sort(compareTagLabels)
  const db = getDb()
  const stmt = db.prepare(`UPDATE tags SET sort_order = ? WHERE id = ?`)
  const tx = db.transaction(() => {
    sorted.forEach((tag, index) => stmt.run(index, tag.id))
  })
  tx()
}

/** Sort direct child tags of `parentTagId` by display label. */
export function sortTagChildrenAlphabetically(parentTagId: number): void {
  const children = listTags().filter((t) => t.parent_id === parentTagId)
  applyAlphabeticalSortOrders(children)
}

/** Sort root tags in a tag group (or uncategorized when `tagGroupId` is null). */
export function sortTagGroupRootsAlphabetically(tagGroupId: number | null): void {
  const roots = listTags().filter(
    (t) => t.parent_id == null && (t.tag_group_id ?? null) === (tagGroupId ?? null)
  )
  applyAlphabeticalSortOrders(roots)
}

export function getTag(id: number): Tag | undefined {
  const row = getDb().prepare(`SELECT * FROM tags WHERE id = ?`).get(id) as TagRow | undefined
  return row ? rowToTag(row) : undefined
}

export function getTagBySlug(slug: string): Tag | undefined {
  const row = getDb().prepare(`SELECT * FROM tags WHERE slug = ?`).get(slug) as TagRow | undefined
  return row ? rowToTag(row) : undefined
}

export function createTag(input: {
  display_name: string
  disambiguator?: string | null
  parent_id?: number | null
  tag_group_id?: number | null
  color?: string | null
  use_custom_color?: boolean
  icon?: string | null
  use_custom_icon?: boolean
  description_md?: string | null
}): Tag {
  const db = getDb()
  let slug = slugifyTag(input.display_name, input.disambiguator)
  let n = 1
  while (getTagBySlug(slug)) {
    slug = `${slugifyTag(input.display_name, input.disambiguator)}-${n++}`
  }
  const parent = input.parent_id != null ? getTag(input.parent_id) : undefined
  const tag_group_id =
    parent != null ? parent.tag_group_id : (input.tag_group_id ?? null)
  const parentId = input.parent_id ?? null
  const sortOrder = nextSortOrderAmongSiblings(parentId, tag_group_id)
  const now = new Date().toISOString()
  const result = db
    .prepare(
      `INSERT INTO tags (slug, display_name, disambiguator, parent_id, tag_group_id, sort_order, color, use_custom_color, icon, use_custom_icon, description_md, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      slug,
      input.display_name,
      input.disambiguator ?? null,
      parentId,
      tag_group_id,
      sortOrder,
      input.color ?? null,
      input.use_custom_color ? 1 : 0,
      input.icon != null ? normalizeTagIcon(input.icon) : null,
      (input.use_custom_icon ?? false) ? 1 : 0,
      input.description_md ?? null,
      now
    )
  const tag = getTag(Number(result.lastInsertRowid))!
  rebuildClosureForTag(tag.id)
  syncTagFts(tag.id)
  return tag
}

export function setTagParent(tagId: number, newParentId: number | null): Tag {
  const tags = listTags()
  if (!canReparentTag(tagId, newParentId, tags)) {
    if (newParentId != null && isDescendantOf(tagId, newParentId, tags)) {
      throw new Error('Cannot move a tag under its own descendant')
    }
    return getTag(tagId)!
  }
  const existing = getTag(tagId)!
  const parent = newParentId != null ? getTag(newParentId) : null
  const tag_group_id = parent != null ? parent.tag_group_id : existing.tag_group_id
  const sortOrder = nextSortOrderAmongSiblings(newParentId, tag_group_id)
  getDb()
    .prepare(`UPDATE tags SET parent_id = ?, tag_group_id = ?, sort_order = ? WHERE id = ?`)
    .run(newParentId, tag_group_id, sortOrder, tagId)
  applyTagGroupToSubtree(tagId, tag_group_id)
  bumpTagGraphEpoch()
  rebuildAllClosure()
  syncTagFts(tagId)
  return getTag(tagId)!
}

export function assignTagToGroup(tagId: number, tagGroupId: number | null): Tag {
  const tags = listTags()
  if (!canAssignTagToGroup(tagId, tagGroupId, tags)) {
    return getTag(tagId)!
  }
  const sortOrder = nextSortOrderAmongSiblings(null, tagGroupId)
  const db = getDb()
  const move = db.transaction(() => {
    applyTagGroupToSubtree(tagId, tagGroupId)
    // Root becomes a group root; descendants keep parent_id pointing at this tag.
    db.prepare(`UPDATE tags SET parent_id = NULL, sort_order = ? WHERE id = ?`).run(sortOrder, tagId)
  })
  move()
  bumpTagGraphEpoch()
  rebuildAllClosure()
  syncTagFts(tagId)
  return getTag(tagId)!
}

export function updateTag(
  id: number,
  patch: Partial<
    Pick<
      Tag,
      | 'display_name'
      | 'disambiguator'
      | 'parent_id'
      | 'tag_group_id'
      | 'color'
      | 'use_custom_color'
      | 'icon'
      | 'use_custom_icon'
      | 'description_md'
    >
  >
): Tag {
  const existing = getTag(id)!
  const previousTagGroupId = existing.tag_group_id
  const display_name = patch.display_name ?? existing.display_name
  const disambiguator = patch.disambiguator !== undefined ? patch.disambiguator : existing.disambiguator
  let parent_id = patch.parent_id !== undefined ? patch.parent_id : existing.parent_id
  let tag_group_id =
    patch.tag_group_id !== undefined ? patch.tag_group_id : existing.tag_group_id
  if (patch.parent_id !== undefined && patch.parent_id != null) {
    tag_group_id = getTag(patch.parent_id)?.tag_group_id ?? tag_group_id
  }
  if (patch.tag_group_id !== undefined && patch.tag_group_id !== existing.tag_group_id) {
    parent_id = null
  }
  const use_custom_color =
    patch.use_custom_color !== undefined ? patch.use_custom_color : existing.use_custom_color
  const use_custom_icon =
    patch.use_custom_icon !== undefined ? patch.use_custom_icon : existing.use_custom_icon
  const icon =
    patch.icon !== undefined
      ? patch.icon != null
        ? normalizeTagIcon(patch.icon)
        : null
      : existing.icon

  getDb()
    .prepare(
      `UPDATE tags SET display_name = ?, disambiguator = ?, parent_id = ?, tag_group_id = ?, color = ?, use_custom_color = ?, icon = ?, use_custom_icon = ?, description_md = ?
       WHERE id = ?`
    )
    .run(
      display_name,
      disambiguator,
      parent_id,
      tag_group_id,
      patch.color !== undefined ? patch.color : existing.color,
      use_custom_color ? 1 : 0,
      icon,
      use_custom_icon ? 1 : 0,
      patch.description_md !== undefined ? patch.description_md : existing.description_md,
      id
    )
  if (tag_group_id !== previousTagGroupId) {
    applyTagGroupToSubtree(id, tag_group_id)
  }
  rebuildClosureForTag(id)
  syncTagFts(id)
  return getTag(id)!
}

function syncTagFts(tagId: number): void {
  const db = getDb()
  const tag = getTag(tagId)
  if (!tag) return
  db.prepare(`DELETE FROM tags_fts WHERE rowid = ?`).run(tag.id)
  db.prepare(
    `INSERT INTO tags_fts(rowid, display_name, disambiguator, description_md) VALUES (?, ?, ?, ?)`
  ).run(tag.id, tag.display_name, tag.disambiguator ?? '', tag.description_md ?? '')
}

export function rebuildClosureForTag(tagId: number): void {
  const db = getDb()
  db.prepare(`DELETE FROM tag_closure WHERE descendant_id = ? OR ancestor_id = ?`).run(tagId, tagId)
  db.prepare(`INSERT INTO tag_closure (ancestor_id, descendant_id, depth) VALUES (?, ?, 0)`).run(
    tagId,
    tagId
  )

  const walk = (parentId: number, depth: number): void => {
    const children = db.prepare(`SELECT id FROM tags WHERE parent_id = ?`).all(parentId) as { id: number }[]
    for (const { id: childId } of children) {
      const ancestors = db
        .prepare(`SELECT ancestor_id, depth FROM tag_closure WHERE descendant_id = ?`)
        .all(parentId) as { ancestor_id: number; depth: number }[]
      for (const a of ancestors) {
        db.prepare(
          `INSERT OR IGNORE INTO tag_closure (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)`
        ).run(a.ancestor_id, childId, a.depth + depth + 1)
      }
      walk(childId, depth + 1)
    }
  }
  walk(tagId, 0)
  bumpTagGraphEpoch()
  rebuildAllClosure()
}

export function rebuildAllClosure(): void {
  const db = getDb()
  db.exec(`DELETE FROM tag_closure`)
  const roots = db.prepare(`SELECT id FROM tags`).all() as { id: number }[]
  for (const { id } of roots) {
    db.prepare(`INSERT OR IGNORE INTO tag_closure (ancestor_id, descendant_id, depth) VALUES (?, ?, 0)`).run(
      id,
      id
    )
  }
  const tags = listTags()
  for (const tag of tags) {
    if (tag.parent_id) {
      const ancestors = db
        .prepare(`SELECT ancestor_id, depth FROM tag_closure WHERE descendant_id = ?`)
        .all(tag.parent_id) as { ancestor_id: number; depth: number }[]
      for (const a of ancestors) {
        db.prepare(
          `INSERT OR IGNORE INTO tag_closure (ancestor_id, descendant_id, depth) VALUES (?, ?, ?)`
        ).run(a.ancestor_id, tag.id, a.depth + 1)
      }
    }
  }
  syncTagClosureEpoch()
}

export function addConnection(
  sourceId: number,
  targetId: number,
  kind: 'hard' | 'soft'
): TagConnection {
  if (sourceId === targetId) {
    throw new Error('A tag cannot connect to itself.')
  }
  const db = getDb()
  const r = db
    .prepare(
      `INSERT INTO tag_connections (source_tag_id, target_tag_id, kind) VALUES (?, ?, ?)
       ON CONFLICT(source_tag_id, target_tag_id, kind) DO NOTHING`
    )
    .run(sourceId, targetId, kind)
  if (r.changes === 0) {
    return db
      .prepare(
        `SELECT * FROM tag_connections WHERE source_tag_id = ? AND target_tag_id = ? AND kind = ?`
      )
      .get(sourceId, targetId, kind) as TagConnection
  }
  const connection = db
    .prepare(`SELECT * FROM tag_connections WHERE id = ?`)
    .get(r.lastInsertRowid) as TagConnection
  if (kind === 'soft') refreshSuggestionsForTagSource(sourceId)
  return connection
}

export function removeConnection(id: number): void {
  const db = getDb()
  const row = db
    .prepare(`SELECT source_tag_id, kind FROM tag_connections WHERE id = ?`)
    .get(id) as { source_tag_id: number; kind: 'hard' | 'soft' } | undefined
  db.prepare(`DELETE FROM tag_connections WHERE id = ?`).run(id)
  if (row?.kind === 'soft') refreshSuggestionsForTagSource(row.source_tag_id)
}

export function getConnections(sourceId: number): TagConnection[] {
  return getDb()
    .prepare(`SELECT * FROM tag_connections WHERE source_tag_id = ?`)
    .all(sourceId) as TagConnection[]
}

export function getSoftSuggestions(sourceId: number): Tag[] {
  const rows = getDb()
    .prepare(
      `SELECT t.* FROM tag_connections tc JOIN tags t ON t.id = tc.target_tag_id
       WHERE tc.source_tag_id = ? AND tc.kind = 'soft'`
    )
    .all(sourceId) as Tag[]
  return rows
}

export function getHardLinkedTagIds(sourceId: number): number[] {
  return (
    getDb()
      .prepare(
        `SELECT target_tag_id FROM tag_connections WHERE source_tag_id = ? AND kind = 'hard'`
      )
      .all(sourceId) as { target_tag_id: number }[]
  ).map((r) => r.target_tag_id)
}

export function addExternalLink(tagId: number, label: string, url: string): TagExternalLink {
  const r = getDb()
    .prepare(`INSERT INTO tag_external_links (tag_id, label, url) VALUES (?, ?, ?)`)
    .run(tagId, label.trim(), url.trim())
  return getDb()
    .prepare(`SELECT * FROM tag_external_links WHERE id = ?`)
    .get(r.lastInsertRowid) as TagExternalLink
}

export function updateExternalLink(id: number, label: string, url: string): TagExternalLink {
  getDb()
    .prepare(`UPDATE tag_external_links SET label = ?, url = ? WHERE id = ?`)
    .run(label.trim(), url.trim(), id)
  return getDb()
    .prepare(`SELECT * FROM tag_external_links WHERE id = ?`)
    .get(id) as TagExternalLink
}

export function removeExternalLink(id: number): void {
  getDb().prepare(`DELETE FROM tag_external_links WHERE id = ?`).run(id)
}

export function listExternalLinks(tagId: number): TagExternalLink[] {
  return getDb()
    .prepare(
      `SELECT * FROM tag_external_links WHERE tag_id = ? ORDER BY label COLLATE NOCASE`
    )
    .all(tagId) as TagExternalLink[]
}

export function searchTagsFts(query: string): Tag[] {
  const q = query.trim()
  if (!q) return listTags()
  return getDb()
    .prepare(
      `SELECT t.* FROM tags_fts fts JOIN tags t ON t.id = fts.rowid
       WHERE tags_fts MATCH ? ORDER BY rank LIMIT 50`
    )
    .all(`${q}*`) as Tag[]
}

export function ensureUniversalSubject(mediaId: number): number {
  const db = getDb()
  const existing = db
    .prepare(`SELECT id FROM subjects WHERE media_id = ? AND label = ?`)
    .get(mediaId, UNIVERSAL_SUBJECT_LABEL) as { id: number } | undefined
  if (existing) return existing.id
  const r = db
    .prepare(`INSERT INTO subjects (media_id, label, sort_order) VALUES (?, ?, 0)`)
    .run(mediaId, UNIVERSAL_SUBJECT_LABEL)
  return Number(r.lastInsertRowid)
}

export function listSubjects(mediaId: number) {
  return getDb()
    .prepare(`SELECT * FROM subjects WHERE media_id = ? ORDER BY sort_order, id`)
    .all(mediaId)
}

export function addSubject(mediaId: number, label: string): number {
  const trimmed = label.trim()
  if (!trimmed) throw new Error('Subject label is required.')
  if (isUniversalSubjectLabel(trimmed)) {
    throw new Error('“Universal” is reserved for the default subject.')
  }
  const max = getDb()
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM subjects WHERE media_id = ?`)
    .get(mediaId) as { n: number }
  const r = getDb()
    .prepare(`INSERT INTO subjects (media_id, label, sort_order) VALUES (?, ?, ?)`)
    .run(mediaId, trimmed, max.n)
  return Number(r.lastInsertRowid)
}

export function removeSubject(subjectId: number): void {
  const db = getDb()
  const row = db
    .prepare(`SELECT id, label FROM subjects WHERE id = ?`)
    .get(subjectId) as { id: number; label: string } | undefined
  if (!row) return
  if (isUniversalSubjectLabel(row.label)) {
    throw new Error('The Universal subject cannot be removed.')
  }
  db.prepare(`DELETE FROM media_tags WHERE subject_id = ?`).run(subjectId)
  db.prepare(`DELETE FROM subjects WHERE id = ?`).run(subjectId)
}

export function updateSubject(subjectId: number, patch: SubjectUpdatePatch): void {
  const db = getDb()
  const row = db
    .prepare(`SELECT * FROM subjects WHERE id = ?`)
    .get(subjectId) as
    | {
        id: number
        media_id: number
        label: string
      }
    | undefined
  if (!row) throw new Error('Subject not found.')

  if (patch.label !== undefined) {
    if (isUniversalSubjectLabel(row.label)) {
      throw new Error('The Universal subject cannot be renamed.')
    }
    const trimmed = patch.label.trim()
    if (!trimmed) throw new Error('Subject label is required.')
    if (isUniversalSubjectLabel(trimmed)) {
      throw new Error('“Universal” is reserved for the default subject.')
    }
    const dup = db
      .prepare(`SELECT id FROM subjects WHERE media_id = ? AND label = ? AND id != ?`)
      .get(row.media_id, trimmed, subjectId) as { id: number } | undefined
    if (dup) throw new Error('A subject with that name already exists on this media item.')
    db.prepare(`UPDATE subjects SET label = ? WHERE id = ?`).run(trimmed, subjectId)
  }

  if (patch.region !== undefined) {
    if (isUniversalSubjectLabel(row.label)) {
      throw new Error('The Universal subject cannot have a region.')
    }
    if (patch.region === null) {
      db.prepare(
        `UPDATE subjects SET region_x = NULL, region_y = NULL, region_w = NULL, region_h = NULL WHERE id = ?`
      ).run(subjectId)
    } else {
      const rect = validateCropRect(patch.region)
      db.prepare(
        `UPDATE subjects SET region_x = ?, region_y = ?, region_w = ?, region_h = ? WHERE id = ?`
      ).run(rect.x, rect.y, rect.w, rect.h, subjectId)
    }
  }
}

export function clearSubjectRegion(subjectId: number): void {
  updateSubject(subjectId, { region: null })
}

function refreshSuggestionsForTagSource(sourceTagId: number): void {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT media_id, subject_id FROM media_tags WHERE tag_id = ? AND subject_id IS NOT NULL`
    )
    .all(sourceTagId) as { media_id: number; subject_id: number }[]
  for (const { media_id, subject_id } of rows) {
    refreshSubjectSuggestions(media_id, subject_id)
  }
}

/** Rebuild persisted soft suggestions for one subject from applied tags + soft connections.
 *  Suppresses a soft suggestion when the tag is already applied on this subject, on Universal
 *  (whole-file scope), or — when rebuilding Universal — on any custom subject. */
export function refreshSubjectSuggestions(mediaId: number, subjectId: number): void {
  const db = getDb()
  db.prepare(`DELETE FROM media_tag_suggestions WHERE media_id = ? AND subject_id = ?`).run(
    mediaId,
    subjectId
  )
  db.prepare(
    `INSERT OR IGNORE INTO media_tag_suggestions (media_id, subject_id, tag_id, source_tag_id)
     SELECT mt.media_id, mt.subject_id, tc.target_tag_id, mt.tag_id
     FROM media_tags mt
     JOIN tag_connections tc ON tc.source_tag_id = mt.tag_id AND tc.kind = 'soft'
     WHERE mt.media_id = ? AND mt.subject_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM media_tags applied
         WHERE applied.media_id = mt.media_id
           AND applied.tag_id = tc.target_tag_id
           AND (
             applied.subject_id = mt.subject_id
             OR applied.subject_id IN (
               SELECT s.id FROM subjects s
               WHERE s.media_id = mt.media_id
                 AND LOWER(TRIM(s.label)) = LOWER(?)
             )
             OR (
               mt.subject_id IN (
                 SELECT s.id FROM subjects s
                 WHERE s.media_id = mt.media_id
                   AND LOWER(TRIM(s.label)) = LOWER(?)
               )
               AND applied.subject_id IN (
                 SELECT s.id FROM subjects s
                 WHERE s.media_id = mt.media_id
                   AND LOWER(TRIM(s.label)) != LOWER(?)
               )
             )
           )
       )`
  ).run(mediaId, subjectId, UNIVERSAL_SUBJECT_LABEL, UNIVERSAL_SUBJECT_LABEL, UNIVERSAL_SUBJECT_LABEL)
}

export function refreshMediaSuggestions(mediaId: number): void {
  const db = getDb()
  const subjectIds = new Set<number>()
  const rows = db
    .prepare(
      `SELECT DISTINCT subject_id FROM media_tags WHERE media_id = ? AND subject_id IS NOT NULL`
    )
    .all(mediaId) as { subject_id: number }[]
  for (const { subject_id } of rows) {
    subjectIds.add(subject_id)
  }
  subjectIds.add(ensureUniversalSubject(mediaId))
  for (const subject_id of subjectIds) {
    refreshSubjectSuggestions(mediaId, subject_id)
  }
}

export function listMediaTagSuggestions(mediaId: number): MediaTagSuggestion[] {
  refreshMediaSuggestions(mediaId)
  const rows = getDb()
    .prepare(
      `SELECT mts.media_id, mts.subject_id, mts.tag_id, mts.source_tag_id, t.*
       FROM media_tag_suggestions mts
       JOIN tags t ON t.id = mts.tag_id
       WHERE mts.media_id = ?
       ORDER BY t.display_name COLLATE NOCASE`
    )
    .all(mediaId) as Array<MediaTagSuggestion & Tag>
  return rows.map((r) => ({
    media_id: r.media_id,
    subject_id: r.subject_id,
    tag_id: r.tag_id,
    source_tag_id: r.source_tag_id,
    tag: rowToTag(r as unknown as TagRow)
  }))
}

function listSuggestionTagsForSubject(mediaId: number, subjectId: number): Tag[] {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT t.*
       FROM media_tag_suggestions mts
       JOIN tags t ON t.id = mts.tag_id
       WHERE mts.media_id = ? AND mts.subject_id = ?
       ORDER BY t.display_name COLLATE NOCASE`
    )
    .all(mediaId, subjectId) as TagRow[]
  return rows.map(rowToTag)
}

export function listMediaTagsForMediaIds(
  mediaIds: number[]
): Record<number, import('../../shared/types').Tag[]> {
  if (mediaIds.length === 0) return {}
  const placeholders = mediaIds.map(() => '?').join(',')
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT mt.media_id, mt.tag_id, t.*
       FROM media_tags mt JOIN tags t ON t.id = mt.tag_id
       WHERE mt.media_id IN (${placeholders})
       ORDER BY mt.media_id, t.display_name COLLATE NOCASE`
    )
    .all(...mediaIds) as Array<{ media_id: number; tag_id: number } & TagRow>

  const result: Record<number, import('../../shared/types').Tag[]> = {}
  const seen = new Map<number, Set<number>>()
  for (const r of rows) {
    let tagIds = seen.get(r.media_id)
    if (!tagIds) {
      tagIds = new Set()
      seen.set(r.media_id, tagIds)
      result[r.media_id] = []
    }
    if (tagIds.has(r.tag_id)) continue
    tagIds.add(r.tag_id)
    result[r.media_id]!.push(rowToTag(r as unknown as TagRow))
  }
  return result
}

export function listMediaTags(mediaId: number): MediaTag[] {
  const rows = getDb()
    .prepare(
      `SELECT mt.media_id, mt.tag_id, mt.subject_id, t.*
       FROM media_tags mt JOIN tags t ON t.id = mt.tag_id
       WHERE mt.media_id = ?`
    )
    .all(mediaId) as Array<MediaTag & Tag>
  return rows.map((r) => ({
    media_id: r.media_id,
    tag_id: r.tag_id,
    subject_id: r.subject_id,
    tag: rowToTag(r as unknown as TagRow)
  }))
}

export type BulkApplySubject =
  | { mode: 'universal' }
  | { mode: 'label'; label: string }

export function findOrEnsureSubject(mediaId: number, label: string): number {
  const trimmed = label.trim()
  if (!trimmed) throw new Error('Subject label is required.')
  if (isUniversalSubjectLabel(trimmed)) return ensureUniversalSubject(mediaId)
  const db = getDb()
  const existing = db
    .prepare(`SELECT id FROM subjects WHERE media_id = ? AND label = ?`)
    .get(mediaId, trimmed) as { id: number } | undefined
  if (existing) return existing.id
  return addSubject(mediaId, trimmed)
}

export function bulkApplyTag(
  mediaIds: number[],
  tagId: number,
  subject: BulkApplySubject
): { applied: number; skipped: number } {
  let applied = 0
  let skipped = 0
  const run = getDb().transaction(() => {
    for (const mediaId of mediaIds) {
      const subjectId =
        subject.mode === 'universal'
          ? ensureUniversalSubject(mediaId)
          : findOrEnsureSubject(mediaId, subject.label)
      if (hasMediaTagInSubject(mediaId, tagId, subjectId)) {
        skipped++
        continue
      }
      applyTag(mediaId, tagId, subjectId)
      applied++
    }
  })
  run()
  return { applied, skipped }
}

export function applyTag(
  mediaId: number,
  tagId: number,
  subjectId: number | null
): { applied: number[]; soft: Tag[] } {
  const db = getDb()
  const groupId = subjectId ?? ensureUniversalSubject(mediaId)
  const toApply = [tagId, ...getHardLinkedTagIds(tagId)]
  const applied: number[] = []

  for (const tid of toApply) {
    if (hasMediaTagInSubject(mediaId, tid, groupId)) continue
    db.prepare(
      `INSERT INTO media_tags (media_id, tag_id, subject_id) VALUES (?, ?, ?)`
    ).run(mediaId, tid, groupId)
    applied.push(tid)
  }

  refreshMediaSuggestions(mediaId)
  const soft = listSuggestionTagsForSubject(mediaId, groupId)
  return { applied, soft }
}

/** True if this tag is already on the media item within the given subject. */
export function hasMediaTagInSubject(
  mediaId: number,
  tagId: number,
  subjectId: number
): boolean {
  return !!getDb()
    .prepare(`SELECT 1 FROM media_tags WHERE media_id = ? AND tag_id = ? AND subject_id = ?`)
    .get(mediaId, tagId, subjectId)
}

export function moveMediaTag(
  mediaId: number,
  tagId: number,
  fromSubjectId: number,
  toSubjectId: number
): void {
  if (fromSubjectId === toSubjectId) return
  const db = getDb()
  if (!hasMediaTagInSubject(mediaId, tagId, fromSubjectId)) return

  const move = db.transaction(() => {
    if (!hasMediaTagInSubject(mediaId, tagId, toSubjectId)) {
      db.prepare(`INSERT INTO media_tags (media_id, tag_id, subject_id) VALUES (?, ?, ?)`).run(
        mediaId,
        tagId,
        toSubjectId
      )
    }
    db.prepare(`DELETE FROM media_tags WHERE media_id = ? AND tag_id = ? AND subject_id = ?`).run(
      mediaId,
      tagId,
      fromSubjectId
    )
  })
  move()
  refreshMediaSuggestions(mediaId)
}

export function removeMediaTag(mediaId: number, tagId: number, subjectId: number | null): void {
  if (subjectId === null) {
    getDb()
      .prepare(`DELETE FROM media_tags WHERE media_id = ? AND tag_id = ?`)
      .run(mediaId, tagId)
  } else {
    getDb()
      .prepare(`DELETE FROM media_tags WHERE media_id = ? AND tag_id = ? AND subject_id = ?`)
      .run(mediaId, tagId, subjectId)
  }
  refreshMediaSuggestions(mediaId)
}

export function getTagDeleteImpact(tagId: number): { mediaCount: number; childCount: number } {
  const db = getDb()
  if (!getTag(tagId)) {
    return { mediaCount: 0, childCount: 0 }
  }
  const mediaCount = (
    db.prepare(`SELECT COUNT(DISTINCT media_id) AS n FROM media_tags WHERE tag_id = ?`).get(tagId) as {
      n: number
    }
  ).n
  const childCount = (
    db.prepare(`SELECT COUNT(*) AS n FROM tags WHERE parent_id = ?`).get(tagId) as { n: number }
  ).n
  return { mediaCount, childCount }
}

export function removeTag(id: number): void {
  const tag = getTag(id)
  if (!tag) throw new Error('Tag not found')

  const db = getDb()
  const refreshKeys = new Map<string, { media_id: number; subject_id: number }>()
  const markRefresh = (media_id: number, subject_id: number | null) => {
    if (subject_id == null) return
    refreshKeys.set(`${media_id}:${subject_id}`, { media_id, subject_id })
  }

  for (const row of db
    .prepare(
      `SELECT DISTINCT media_id, subject_id FROM media_tags WHERE tag_id = ? AND subject_id IS NOT NULL`
    )
    .all(id) as { media_id: number; subject_id: number }[]) {
    markRefresh(row.media_id, row.subject_id)
  }
  for (const row of db
    .prepare(
      `SELECT DISTINCT media_id, subject_id FROM media_tag_suggestions
       WHERE tag_id = ? OR source_tag_id = ?`
    )
    .all(id, id) as { media_id: number; subject_id: number }[]) {
    markRefresh(row.media_id, row.subject_id)
  }

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM wiki_pages WHERE entity_type = 'tag' AND entity_id = ?`).run(id)
    db.prepare(`DELETE FROM tags_fts WHERE rowid = ?`).run(id)
    db.prepare(`DELETE FROM tags WHERE id = ?`).run(id)
  })
  tx()

  bumpTagGraphEpoch()
  rebuildAllClosure()

  if (refreshKeys.size > 0) {
    const refresh = db.transaction(() => {
      for (const { media_id, subject_id } of refreshKeys.values()) {
        refreshSubjectSuggestions(media_id, subject_id)
      }
    })
    refresh()
  }
}

export function tagWithLabel(tag: Tag): { tag: Tag; label: string } {
  return { tag, label: formatTagLabel(tag) }
}
