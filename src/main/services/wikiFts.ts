import { getDb } from '../db/database'
import { buildFtsMatchQuery } from '../../shared/ftsQuery'

export function syncMediaWikiFts(mediaId: number, body_md: string): void {
  const db = getDb()
  db.prepare(`DELETE FROM media_wiki_fts WHERE rowid = ?`).run(mediaId)
  if (body_md.trim()) {
    db.prepare(`INSERT INTO media_wiki_fts(rowid, body_md) VALUES (?, ?)`).run(mediaId, body_md)
  }
}

export function removeMediaWikiFts(mediaId: number): void {
  getDb().prepare(`DELETE FROM media_wiki_fts WHERE rowid = ?`).run(mediaId)
}

export function searchMediaWikiFts(query: string, limit = 5000): number[] {
  const match = buildFtsMatchQuery(query)
  if (!match) return []
  try {
    return (
      getDb()
        .prepare(
          `SELECT rowid AS id FROM media_wiki_fts
           WHERE media_wiki_fts MATCH ?
           ORDER BY rank
           LIMIT ?`
        )
        .all(match, limit) as { id: number }[]
    ).map((r) => r.id)
  } catch {
    return []
  }
}
