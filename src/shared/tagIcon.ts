import type { Tag, TagGroup } from './types'

/** Max Unicode scalar values stored for one tag/group icon. */
const MAX_ICON_LENGTH = 4

export function normalizeTagIcon(input: string | null | undefined): string | null {
  if (input == null) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  const cleaned = trimmed.replace(/[\x00-\x1F\x7F]/g, '')
  const chars = [...cleaned]
  if (chars.length === 0) return null
  return chars.slice(0, MAX_ICON_LENGTH).join('')
}

export function resolveTagIcon(
  tag: Tag,
  tagsById: Map<number, Tag>,
  tagGroupsById: Map<number, TagGroup>
): string | null {
  if (tag.use_custom_icon) {
    return tag.icon ? normalizeTagIcon(tag.icon) : null
  }
  if (tag.parent_id != null) {
    const parent = tagsById.get(tag.parent_id)
    if (parent) return resolveTagIcon(parent, tagsById, tagGroupsById)
  }
  if (tag.tag_group_id != null) {
    const group = tagGroupsById.get(tag.tag_group_id)
    if (group?.icon) return normalizeTagIcon(group.icon)
  }
  return null
}

export function describeIconInheritance(
  tag: Tag,
  tagsById: Map<number, Tag>,
  tagGroupsById: Map<number, TagGroup>
): string {
  if (tag.use_custom_icon) return 'Custom icon'
  if (tag.parent_id != null) {
    const parent = tagsById.get(tag.parent_id)
    if (parent) return `Parent: ${parent.display_name}`
  }
  if (tag.tag_group_id != null) {
    const group = tagGroupsById.get(tag.tag_group_id)
    if (group) return `Tag group: ${group.label}`
  }
  return 'None'
}
