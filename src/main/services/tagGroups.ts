import { getDb } from '../db/database'
import type { TagGroup } from '../../shared/types'
import { DEFAULT_TAG_GROUP_COLOR } from '../../shared/tagColor'
import { normalizeTagIcon } from '../../shared/tagIcon'

function rowToTagGroup(row: TagGroup & { color?: string | null; icon?: string | null }): TagGroup {
  return {
    ...row,
    color: row.color ?? DEFAULT_TAG_GROUP_COLOR,
    icon: row.icon ? normalizeTagIcon(row.icon) : null
  }
}

export function listTagGroups(): TagGroup[] {
  return (
    getDb()
      .prepare(`SELECT * FROM tag_groups ORDER BY sort_order, label COLLATE NOCASE`)
      .all() as TagGroup[]
  ).map(rowToTagGroup)
}

export function createTagGroup(label: string): TagGroup {
  const trimmed = label.trim()
  if (!trimmed) throw new Error('Tag group label is required.')
  const max = getDb()
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM tag_groups`)
    .get() as { n: number }
  const r = getDb()
    .prepare(`INSERT INTO tag_groups (label, sort_order, color) VALUES (?, ?, ?)`)
    .run(trimmed, max.n, DEFAULT_TAG_GROUP_COLOR)
  return rowToTagGroup(
    getDb()
      .prepare(`SELECT * FROM tag_groups WHERE id = ?`)
      .get(Number(r.lastInsertRowid)) as TagGroup
  )
}

export function updateTagGroup(
  id: number,
  patch: { label?: string; color?: string | null; icon?: string | null }
): TagGroup {
  const existing = getDb().prepare(`SELECT * FROM tag_groups WHERE id = ?`).get(id) as
    | TagGroup
    | undefined
  if (!existing) throw new Error('Tag group not found.')

  const label =
    patch.label !== undefined ? patch.label.trim() : existing.label
  if (!label) throw new Error('Tag group label is required.')

  const color = patch.color !== undefined ? patch.color : existing.color
  const icon =
    patch.icon !== undefined
      ? patch.icon != null
        ? normalizeTagIcon(patch.icon)
        : null
      : existing.icon

  getDb()
    .prepare(`UPDATE tag_groups SET label = ?, color = ?, icon = ? WHERE id = ?`)
    .run(label, color, icon, id)

  return rowToTagGroup(
    getDb().prepare(`SELECT * FROM tag_groups WHERE id = ?`).get(id) as TagGroup
  )
}

export function moveTagGroup(id: number, direction: 'up' | 'down'): void {
  const groups = listTagGroups()
  const idx = groups.findIndex((g) => g.id === id)
  if (idx < 0) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= groups.length) return

  const a = groups[idx]!
  const b = groups[swapIdx]!
  const db = getDb()
  const move = db.transaction(() => {
    db.prepare(`UPDATE tag_groups SET sort_order = ? WHERE id = ?`).run(b.sort_order, a.id)
    db.prepare(`UPDATE tag_groups SET sort_order = ? WHERE id = ?`).run(a.sort_order, b.id)
  })
  move()
}

export function removeTagGroup(id: number): void {
  getDb().prepare(`UPDATE tags SET tag_group_id = NULL WHERE tag_group_id = ?`).run(id)
  getDb().prepare(`DELETE FROM tag_groups WHERE id = ?`).run(id)
}
