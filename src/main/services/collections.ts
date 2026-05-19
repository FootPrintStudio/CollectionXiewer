import { getDb } from '../db/database'
import type { Collection, CollectionMember, CollectionWithStats, MediaItem, Tag } from '../../shared/types'
import { enrichMedia } from './mediaPaths'

export function listCollections(): CollectionWithStats[] {
  return getDb()
    .prepare(
      `SELECT c.*, COUNT(cm.media_id) AS member_count
       FROM collections c
       LEFT JOIN collection_members cm ON cm.collection_id = c.id
       GROUP BY c.id
       ORDER BY c.name COLLATE NOCASE`
    )
    .all() as CollectionWithStats[]
}

export function getCollection(id: number): Collection | undefined {
  return getDb().prepare(`SELECT * FROM collections WHERE id = ?`).get(id) as Collection
}

export function createCollection(name: string, description_md?: string): Collection {
  const now = new Date().toISOString()
  const r = getDb()
    .prepare(`INSERT INTO collections (name, description_md, created_at) VALUES (?, ?, ?)`)
    .run(name, description_md ?? null, now)
  const col = getCollection(Number(r.lastInsertRowid))!
  syncCollectionFts(col.id)
  return col
}

export function updateCollection(
  id: number,
  patch: Partial<Pick<Collection, 'name' | 'description_md'>>
): Collection {
  const c = getCollection(id)!
  getDb()
    .prepare(`UPDATE collections SET name = ?, description_md = ? WHERE id = ?`)
    .run(patch.name ?? c.name, patch.description_md ?? c.description_md, id)
  syncCollectionFts(id)
  return getCollection(id)!
}

export function deleteCollection(id: number): void {
  getDb().prepare(`DELETE FROM collections WHERE id = ?`).run(id)
}

function syncCollectionFts(id: number): void {
  const c = getCollection(id)
  if (!c) return
  const db = getDb()
  db.prepare(`DELETE FROM collections_fts WHERE rowid = ?`).run(c.id)
  db.prepare(`INSERT INTO collections_fts(rowid, name, description_md) VALUES (?, ?, ?)`).run(
    c.id,
    c.name,
    c.description_md ?? ''
  )
}

export function addToCollection(collectionId: number, mediaId: number): void {
  const media = getDb()
    .prepare(`SELECT relative_path FROM media_items WHERE id = ?`)
    .get(mediaId) as { relative_path: string }
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO collection_members (collection_id, media_id, sort_key) VALUES (?, ?, ?)`
    )
    .run(collectionId, mediaId, media.relative_path)
}

export function removeFromCollection(collectionId: number, mediaId: number): void {
  getDb()
    .prepare(`DELETE FROM collection_members WHERE collection_id = ? AND media_id = ?`)
    .run(collectionId, mediaId)
}

export function listCollectionsForMedia(mediaId: number): Collection[] {
  return getDb()
    .prepare(
      `SELECT c.* FROM collections c
       JOIN collection_members cm ON cm.collection_id = c.id
       WHERE cm.media_id = ?
       ORDER BY c.name COLLATE NOCASE`
    )
    .all(mediaId) as Collection[]
}

export function listCollectionMembers(collectionId: number): CollectionMember[] {
  return getDb()
    .prepare(
      `SELECT * FROM collection_members WHERE collection_id = ? ORDER BY sort_key COLLATE NOCASE`
    )
    .all(collectionId) as CollectionMember[]
}

export function listCollectionMedia(collectionId: number): MediaItem[] {
  const rows = getDb()
    .prepare(
      `SELECT m.id, m.root_id, m.relative_path, m.mime, m.kind, m.width, m.height,
              m.duration_ms, m.mtime, m.indexed_at, m.missing, r.path AS root_path
       FROM collection_members cm
       JOIN media_items m ON m.id = cm.media_id
       JOIN watch_roots r ON r.id = m.root_id
       WHERE cm.collection_id = ? AND m.missing = 0
       ORDER BY cm.sort_key COLLATE NOCASE`
    )
    .all(collectionId) as Array<Omit<MediaItem, 'absolute_path'> & { root_path: string }>
  return rows.map((r) => enrichMedia(r, r.root_path))
}

export function setPrincipalTags(collectionId: number, tagIds: number[]): void {
  const db = getDb()
  db.prepare(`DELETE FROM collection_principal_tags WHERE collection_id = ?`).run(collectionId)
  const stmt = db.prepare(
    `INSERT INTO collection_principal_tags (collection_id, tag_id) VALUES (?, ?)`
  )
  for (const tagId of tagIds) stmt.run(collectionId, tagId)
}

export function getPrincipalTags(collectionId: number): Tag[] {
  return getDb()
    .prepare(
      `SELECT t.* FROM collection_principal_tags cpt JOIN tags t ON t.id = cpt.tag_id
       WHERE cpt.collection_id = ?`
    )
    .all(collectionId) as Tag[]
}

export function searchCollectionsByPrincipalTag(tagId: number): Collection[] {
  return getDb()
    .prepare(
      `SELECT c.* FROM collections c
       JOIN collection_principal_tags cpt ON cpt.collection_id = c.id
       WHERE cpt.tag_id = ?`
    )
    .all(tagId) as Collection[]
}

export function searchCollectionsFts(query: string): Collection[] {
  const q = query.trim()
  if (!q) return listCollections()
  return getDb()
    .prepare(
      `SELECT c.* FROM collections_fts fts JOIN collections c ON c.id = fts.rowid
       WHERE collections_fts MATCH ? LIMIT 50`
    )
    .all(`${q}*`) as Collection[]
}
