import { getDb } from '../db/database'
import type { Identifier } from '../../shared/types'
import { parseSearchQuery, type SearchResolveContext } from '../../shared/searchParser'
import * as tags from './tags'
import * as collections from './collections'
import * as roots from './roots'

type IdentifierRow = Identifier & { enabled: number }

function rowToIdentifier(row: IdentifierRow): Identifier {
  return {
    id: row.id,
    label: row.label,
    icon: row.icon,
    color: row.color,
    query_text: row.query_text,
    query_ast: row.query_ast,
    sort_order: row.sort_order,
    enabled: row.enabled
  }
}

export function buildSearchResolveContext(): SearchResolveContext {
  return {
    tags: tags.listTags().map((t) => ({
      id: t.id,
      slug: t.slug,
      display_name: t.display_name,
      disambiguator: t.disambiguator
    })),
    collections: collections.listCollections().map((c) => ({ id: c.id, name: c.name })),
    roots: roots.listRoots().map((r) => ({ id: r.id, path: r.path }))
  }
}

export function listIdentifiers(): Identifier[] {
  return (
    getDb()
      .prepare(`SELECT * FROM identifiers ORDER BY sort_order, id`)
      .all() as IdentifierRow[]
  ).map(rowToIdentifier)
}

export function getIdentifier(id: number): Identifier | null {
  const row = getDb().prepare(`SELECT * FROM identifiers WHERE id = ?`).get(id) as
    | IdentifierRow
    | undefined
  return row ? rowToIdentifier(row) : null
}

export interface IdentifierInput {
  label: string
  icon: string
  color: string
  query_text: string
}

export function validateIdentifierQuery(
  query_text: string
): { astJson: string } | { error: string } {
  const trimmed = query_text.trim()
  if (!trimmed) return { error: 'Search query is required.' }
  const ctx = buildSearchResolveContext()
  const { ast, errors } = parseSearchQuery(trimmed, ctx)
  if (errors.length > 0) return { error: errors[0]!.message }
  return { astJson: JSON.stringify(ast) }
}

export function createIdentifier(input: IdentifierInput): Identifier {
  const validated = validateIdentifierQuery(input.query_text)
  if ('error' in validated) throw new Error(validated.error)
  const icon = input.icon.trim()
  if (!icon) throw new Error('Icon is required.')
  const label = input.label.trim()
  if (!label) throw new Error('Label is required.')
  const max = getDb()
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM identifiers`)
    .get() as { n: number }
  const r = getDb()
    .prepare(
      `INSERT INTO identifiers (label, icon, color, query_text, query_ast, sort_order, enabled)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    )
    .run(label, icon, input.color, input.query_text.trim(), validated.astJson, max.n)
  return getIdentifier(Number(r.lastInsertRowid))!
}

export function updateIdentifier(id: number, input: IdentifierInput): Identifier {
  const validated = validateIdentifierQuery(input.query_text)
  if ('error' in validated) throw new Error(validated.error)
  const icon = input.icon.trim()
  if (!icon) throw new Error('Icon is required.')
  const label = input.label.trim()
  if (!label) throw new Error('Label is required.')
  getDb()
    .prepare(
      `UPDATE identifiers SET label = ?, icon = ?, color = ?, query_text = ?, query_ast = ?
       WHERE id = ?`
    )
    .run(label, icon, input.color, input.query_text.trim(), validated.astJson, id)
  return getIdentifier(id)!
}

export function deleteIdentifier(id: number): void {
  getDb().prepare(`DELETE FROM identifiers WHERE id = ?`).run(id)
}

export function setIdentifierEnabled(id: number, enabled: boolean): Identifier {
  getDb().prepare(`UPDATE identifiers SET enabled = ? WHERE id = ?`).run(enabled ? 1 : 0, id)
  return getIdentifier(id)!
}

export function moveIdentifier(id: number, direction: 'up' | 'down'): void {
  const db = getDb()
  const row = db.prepare(`SELECT id, sort_order FROM identifiers WHERE id = ?`).get(id) as
    | { id: number; sort_order: number }
    | undefined
  if (!row) return
  const neighbor = db
    .prepare(
      `SELECT id, sort_order FROM identifiers
       WHERE sort_order ${direction === 'up' ? '<' : '>'} ?
       ORDER BY sort_order ${direction === 'up' ? 'DESC' : 'ASC'}
       LIMIT 1`
    )
    .get(row.sort_order) as { id: number; sort_order: number } | undefined
  if (!neighbor) return
  const tx = db.transaction(() => {
    db.prepare(`UPDATE identifiers SET sort_order = ? WHERE id = ?`).run(neighbor.sort_order, row.id)
    db.prepare(`UPDATE identifiers SET sort_order = ? WHERE id = ?`).run(row.sort_order, neighbor.id)
  })
  tx()
}
