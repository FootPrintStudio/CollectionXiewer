export const TAG_DROP_UNCATEGORIZED = 'tag-drop-uncategorized'

export const TAG_GROUP_DROP_PREFIX = 'tag-group-drop-'

export function tagGroupDropId(tagGroupId: number): string {
  return `${TAG_GROUP_DROP_PREFIX}${tagGroupId}`
}

export function tagDragId(tagId: number): string {
  return `tag-drag-${tagId}`
}

export function tagDropId(tagId: number): string {
  return `tag-drop-${tagId}`
}

export function mediaDropId(mediaId: number): string {
  return `media-drop-${mediaId}`
}

export function mediaTagsDropId(mediaId: number): string {
  return `media-tags-drop-${mediaId}`
}

export function subjectDropId(mediaId: number, subjectId: number): string {
  return `media-subject-drop-${mediaId}-${subjectId}`
}

export function parseSubjectDropId(
  id: string | number
): { mediaId: number; subjectId: number } | null {
  const s = String(id)
  if (!s.startsWith('media-subject-drop-')) return null
  const rest = s.slice('media-subject-drop-'.length)
  const sep = rest.lastIndexOf('-')
  if (sep <= 0) return null
  const mediaId = Number(rest.slice(0, sep))
  const subjectId = Number(rest.slice(sep + 1))
  if (!Number.isFinite(mediaId) || !Number.isFinite(subjectId)) return null
  return { mediaId, subjectId }
}

export function parseTagDragId(id: string | number): number | null {
  const s = String(id)
  if (!s.startsWith('tag-drag-')) return null
  const n = Number(s.slice('tag-drag-'.length))
  return Number.isFinite(n) ? n : null
}

export function parseTagDropId(id: string | number): number | null {
  const s = String(id)
  if (!s.startsWith('tag-drop-')) return null
  const n = Number(s.slice('tag-drop-'.length))
  return Number.isFinite(n) ? n : null
}

export function parseMediaDropId(id: string | number): number | null {
  const s = String(id)
  if (!s.startsWith('media-drop-')) return null
  const n = Number(s.slice('media-drop-'.length))
  return Number.isFinite(n) ? n : null
}

export function parseMediaTagsDropId(id: string | number): number | null {
  const s = String(id)
  if (!s.startsWith('media-tags-drop-')) return null
  const n = Number(s.slice('media-tags-drop-'.length))
  return Number.isFinite(n) ? n : null
}

export function parseMediaTagTargetId(id: string | number): number | null {
  const sub = parseSubjectDropId(id)
  if (sub) return sub.mediaId
  return parseMediaDropId(id) ?? parseMediaTagsDropId(id) ?? null
}

export function parseMediaTagDropTarget(
  id: string | number
): { mediaId: number; subjectId?: number } | null {
  const sub = parseSubjectDropId(id)
  if (sub) return { mediaId: sub.mediaId, subjectId: sub.subjectId }
  const mediaId = parseMediaDropId(id) ?? parseMediaTagsDropId(id)
  return mediaId != null ? { mediaId } : null
}

export function parseTagGroupDropId(id: string | number): number | null | undefined {
  const s = String(id)
  if (s === TAG_DROP_UNCATEGORIZED) return null
  if (!s.startsWith(TAG_GROUP_DROP_PREFIX)) return undefined
  const n = Number(s.slice(TAG_GROUP_DROP_PREFIX.length))
  return Number.isFinite(n) ? n : undefined
}

export function isTagReparentDropId(id: string): boolean {
  return parseTagGroupDropId(id) !== undefined || parseTagDropId(id) != null
}

export type TagDragData = { type: 'tag'; tagId: number }

export type MediaTagDragData = {
  type: 'media-tag'
  mediaId: number
  tagId: number
  sourceSubjectId: number
}

export type { MediaDragData } from './collectionDnd'

export function mediaTagDragId(mediaId: number, subjectId: number, tagId: number): string {
  return `media-tag-drag-${mediaId}-${subjectId}-${tagId}`
}

export function parseMediaTagDragId(
  id: string | number
): { mediaId: number; subjectId: number; tagId: number } | null {
  const s = String(id)
  if (!s.startsWith('media-tag-drag-')) return null
  const rest = s.slice('media-tag-drag-'.length)
  const last = rest.lastIndexOf('-')
  const mid = rest.lastIndexOf('-', last - 1)
  if (mid <= 0 || last <= mid) return null
  const mediaId = Number(rest.slice(0, mid))
  const subjectId = Number(rest.slice(mid + 1, last))
  const tagId = Number(rest.slice(last + 1))
  if (!Number.isFinite(mediaId) || !Number.isFinite(subjectId) || !Number.isFinite(tagId)) {
    return null
  }
  return { mediaId, subjectId, tagId }
}

export function isMediaTagDragId(id: string | number): boolean {
  return String(id).startsWith('media-tag-drag-')
}

export const TAG_HOLD_MS = 650
