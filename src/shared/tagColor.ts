import type { Tag, TagGroup } from './types'

export const DEFAULT_TAG_COLOR = '#8b4513'
export const DEFAULT_TAG_GROUP_COLOR = '#6b5b95'

export function resolveTagColor(
  tag: Tag,
  tagsById: Map<number, Tag>,
  tagGroupsById: Map<number, TagGroup>
): string {
  if (tag.use_custom_color) {
    return tag.color ?? DEFAULT_TAG_COLOR
  }
  if (tag.parent_id != null) {
    const parent = tagsById.get(tag.parent_id)
    if (parent) return resolveTagColor(parent, tagsById, tagGroupsById)
  }
  if (tag.tag_group_id != null) {
    const group = tagGroupsById.get(tag.tag_group_id)
    if (group?.color) return group.color
  }
  return DEFAULT_TAG_COLOR
}

export function describeColorInheritance(
  tag: Tag,
  tagsById: Map<number, Tag>,
  tagGroupsById: Map<number, TagGroup>
): string {
  if (tag.use_custom_color) return 'Custom colour'
  if (tag.parent_id != null) {
    const parent = tagsById.get(tag.parent_id)
    if (parent) return `Parent: ${parent.display_name}`
  }
  if (tag.tag_group_id != null) {
    const group = tagGroupsById.get(tag.tag_group_id)
    if (group) return `Tag group: ${group.label}`
  }
  return 'Default'
}
