import { getDb } from '../db/database'
import type { WikiPage } from '../../shared/types'
import { syncMediaWikiFts } from './wikiFts'

export function getWiki(
  entityType: WikiPage['entity_type'],
  entityId: number
): WikiPage {
  const row = getDb()
    .prepare(`SELECT * FROM wiki_pages WHERE entity_type = ? AND entity_id = ?`)
    .get(entityType, entityId) as WikiPage | undefined
  if (row) return row
  return {
    entity_type: entityType,
    entity_id: entityId,
    body_md: '',
    updated_at: new Date().toISOString()
  }
}

export function saveWiki(
  entityType: WikiPage['entity_type'],
  entityId: number,
  body_md: string
): WikiPage {
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO wiki_pages (entity_type, entity_id, body_md, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(entity_type, entity_id) DO UPDATE SET body_md = excluded.body_md, updated_at = excluded.updated_at`
    )
    .run(entityType, entityId, body_md, now)
  if (entityType === 'media') {
    syncMediaWikiFts(entityId, body_md)
  }
  return getWiki(entityType, entityId)
}
