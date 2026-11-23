import { basename, relative, resolve, sep } from 'node:path'
import { getDb } from '../db/database'
import type { CopyTagsSubjectsResult, MediaItem, MediaVariantRef } from '../../shared/types'
import { isUniversalSubjectLabel } from '../../shared/subjects'
import { enrichMediaWithCrop } from './mediaPaths'
import { getMedia } from './mediaQuery'
import {
  applyTag,
  ensureUniversalSubject,
  findOrEnsureSubject,
  hasMediaTagInSubject,
  listMediaTags,
  listSubjects
} from './tags'
import type { Subject } from '../../shared/types'

function groupIdForMedia(mediaId: number): number | null {
  const row = getDb()
    .prepare(`SELECT group_id FROM media_variant_members WHERE media_id = ?`)
    .get(mediaId) as { group_id: number } | undefined
  return row?.group_id ?? null
}

function memberCount(groupId: number): number {
  return (
    getDb()
      .prepare(`SELECT COUNT(*) AS c FROM media_variant_members WHERE group_id = ?`)
      .get(groupId) as { c: number }
  ).c
}

function deleteGroupIfEmpty(groupId: number): void {
  if (memberCount(groupId) === 0) {
    getDb().prepare(`DELETE FROM media_variant_groups WHERE id = ?`).run(groupId)
  }
}

function createGroup(): number {
  const r = getDb()
    .prepare(`INSERT INTO media_variant_groups (created_at) VALUES (?)`)
    .run(new Date().toISOString())
  return Number(r.lastInsertRowid)
}

function addMember(groupId: number, mediaId: number): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO media_variant_members (group_id, media_id) VALUES (?, ?)`
    )
    .run(groupId, mediaId)
}

function moveAllMembers(fromGroupId: number, toGroupId: number): void {
  const db = getDb()
  const members = db
    .prepare(`SELECT media_id FROM media_variant_members WHERE group_id = ?`)
    .all(fromGroupId) as { media_id: number }[]
  const insert = db.prepare(
    `INSERT OR IGNORE INTO media_variant_members (group_id, media_id) VALUES (?, ?)`
  )
  for (const m of members) {
    insert.run(toGroupId, m.media_id)
  }
  db.prepare(`DELETE FROM media_variant_members WHERE group_id = ?`).run(fromGroupId)
  db.prepare(`DELETE FROM media_variant_groups WHERE id = ?`).run(fromGroupId)
}

export function listVariants(mediaId: number): MediaVariantRef[] {
  const gid = groupIdForMedia(mediaId)
  if (gid == null) return []
  return getDb()
    .prepare(
      `SELECT m.id, m.relative_path, m.kind, m.width, m.height, m.missing
       FROM media_variant_members v
       JOIN media_items m ON m.id = v.media_id
       WHERE v.group_id = ? AND v.media_id != ?
       ORDER BY m.relative_path COLLATE NOCASE`
    )
    .all(gid, mediaId) as MediaVariantRef[]
}

/** All members of the variant group for `mediaId` (including itself) as full MediaItems. */
export function listVariantGroup(mediaId: number): MediaItem[] {
  const gid = groupIdForMedia(mediaId)
  if (gid == null) {
    const solo = getMedia(mediaId)
    return solo ? [solo] : []
  }
  const rows = getDb()
    .prepare(
      `SELECT m.*, r.path AS root_path,
              c.x AS crop_x, c.y AS crop_y, c.w AS crop_w, c.h AS crop_h
       FROM media_variant_members v
       JOIN media_items m ON m.id = v.media_id
       JOIN watch_roots r ON r.id = m.root_id
       LEFT JOIN media_crop c ON c.media_id = m.id
       WHERE v.group_id = ?
       ORDER BY m.relative_path COLLATE NOCASE`
    )
    .all(gid) as Array<
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

/** Link two media items as variants (merge groups as needed). */
export function linkVariants(mediaId: number, otherMediaId: number): void {
  if (mediaId === otherMediaId) {
    throw new Error('A media item cannot be a variant of itself.')
  }
  if (!getMedia(mediaId) || !getMedia(otherMediaId)) {
    throw new Error('Media item not found.')
  }

  const run = getDb().transaction(() => {
    const a = groupIdForMedia(mediaId)
    const b = groupIdForMedia(otherMediaId)
    if (a != null && b != null) {
      if (a === b) return
      // Merge smaller id into larger? Keep `a` as survivor.
      moveAllMembers(b, a)
      return
    }
    if (a != null) {
      addMember(a, otherMediaId)
      return
    }
    if (b != null) {
      addMember(b, mediaId)
      return
    }
    const gid = createGroup()
    addMember(gid, mediaId)
    addMember(gid, otherMediaId)
  })
  run()
}

/** Remove `otherMediaId` from the variant group of `mediaId` (other leaves the group). */
export function unlinkVariant(mediaId: number, otherMediaId: number): void {
  if (mediaId === otherMediaId) return
  const run = getDb().transaction(() => {
    const gid = groupIdForMedia(mediaId)
    if (gid == null) return
    const otherGid = groupIdForMedia(otherMediaId)
    if (otherGid !== gid) return
    getDb().prepare(`DELETE FROM media_variant_members WHERE media_id = ?`).run(otherMediaId)
    // If only one member left, dissolve the group.
    if (memberCount(gid) < 2) {
      getDb().prepare(`DELETE FROM media_variant_members WHERE group_id = ?`).run(gid)
      getDb().prepare(`DELETE FROM media_variant_groups WHERE id = ?`).run(gid)
    } else {
      deleteGroupIfEmpty(gid)
    }
  })
  run()
}

/**
 * Resolve an absolute filesystem path to an indexed media item under a watch root.
 */
export function findMediaByAbsolutePath(absolutePath: string): MediaItem | null {
  const resolved = resolve(absolutePath)
  const roots = getDb()
    .prepare(`SELECT id, path FROM watch_roots`)
    .all() as { id: number; path: string }[]

  for (const root of roots) {
    const rootPath = resolve(root.path)
    const rel = relative(rootPath, resolved)
    if (!rel || rel.startsWith('..') || rel.startsWith(`..${sep}`)) continue
    if (rel === '' || rel === '.') continue
    const row = getDb()
      .prepare(
        `SELECT m.*, r.path AS root_path,
                c.x AS crop_x, c.y AS crop_y, c.w AS crop_w, c.h AS crop_h
         FROM media_items m
         JOIN watch_roots r ON r.id = m.root_id
         LEFT JOIN media_crop c ON c.media_id = m.id
         WHERE m.root_id = ? AND m.relative_path = ?`
      )
      .get(root.id, rel) as
      | (Omit<MediaItem, 'absolute_path'> & {
          root_path: string
          crop_x?: number | null
          crop_y?: number | null
          crop_w?: number | null
          crop_h?: number | null
        })
      | undefined
    if (row) return enrichMediaWithCrop(row)
  }
  return null
}

/** Copy subjects (by label) and their tags from source → target. Additive; does not remove existing. */
export function copyTagsAndSubjects(
  targetMediaId: number,
  sourceMediaId: number
): CopyTagsSubjectsResult {
  if (targetMediaId === sourceMediaId) {
    throw new Error('Choose a different media item as the copy source.')
  }
  if (!getMedia(targetMediaId) || !getMedia(sourceMediaId)) {
    throw new Error('Media item not found.')
  }

  let subjectsCreated = 0
  let tagsApplied = 0
  let tagsSkipped = 0

  const run = getDb().transaction(() => {
    ensureUniversalSubject(targetMediaId)
    const sourceSubjects = listSubjects(sourceMediaId) as Subject[]
    const sourceTags = listMediaTags(sourceMediaId)

    const labelToTargetSubjectId = new Map<string, number>()

    for (const subject of sourceSubjects) {
      let targetSubjectId: number
      if (isUniversalSubjectLabel(subject.label)) {
        targetSubjectId = ensureUniversalSubject(targetMediaId)
      } else {
        const before = getDb()
          .prepare(`SELECT id FROM subjects WHERE media_id = ? AND label = ?`)
          .get(targetMediaId, subject.label) as { id: number } | undefined
        targetSubjectId = findOrEnsureSubject(targetMediaId, subject.label)
        if (!before) subjectsCreated++

        // Copy region when target subject has none and source has one.
        if (
          subject.region_x != null &&
          subject.region_y != null &&
          subject.region_w != null &&
          subject.region_h != null
        ) {
          const target = getDb()
            .prepare(
              `SELECT region_x FROM subjects WHERE id = ?`
            )
            .get(targetSubjectId) as { region_x: number | null }
          if (target.region_x == null) {
            getDb()
              .prepare(
                `UPDATE subjects SET region_x = ?, region_y = ?, region_w = ?, region_h = ? WHERE id = ?`
              )
              .run(
                subject.region_x,
                subject.region_y,
                subject.region_w,
                subject.region_h,
                targetSubjectId
              )
          }
        }
      }
      labelToTargetSubjectId.set(subject.label, targetSubjectId)
    }

    for (const row of sourceTags) {
      if (row.subject_id == null) continue
      const sourceSubject = sourceSubjects.find((s) => s.id === row.subject_id)
      if (!sourceSubject) continue
      const targetSubjectId = labelToTargetSubjectId.get(sourceSubject.label)
      if (targetSubjectId == null) continue
      if (hasMediaTagInSubject(targetMediaId, row.tag_id, targetSubjectId)) {
        tagsSkipped++
        continue
      }
      const result = applyTag(targetMediaId, row.tag_id, targetSubjectId)
      tagsApplied += result.applied.length
    }
  })
  run()

  return { subjectsCreated, tagsApplied, tagsSkipped }
}

export function displayNameForMedia(media: Pick<MediaItem, 'relative_path'> | MediaVariantRef): string {
  return basename(media.relative_path)
}
