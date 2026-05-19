import type { Tag, TagGroup } from './types'

export interface TagTreeNode {
  tag: Tag
  children: TagTreeNode[]
}

export interface TagLibrarySection {
  tagGroup: TagGroup | null
  roots: TagTreeNode[]
}

export function buildTagTree(tags: Tag[]): TagTreeNode[] {
  const byId = new Map<number, TagTreeNode>()
  for (const tag of tags) {
    byId.set(tag.id, { tag, children: [] })
  }

  const roots: TagTreeNode[] = []
  for (const tag of tags) {
    const node = byId.get(tag.id)!
    if (tag.parent_id != null && byId.has(tag.parent_id)) {
      byId.get(tag.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  sortNodes(roots)
  return roots
}

/** Groups tags into tag group containers for the Tags Library tree. */
export function buildTagLibrarySections(
  tagGroups: TagGroup[],
  tags: Tag[]
): TagLibrarySection[] {
  const byGroup = new Map<number | null, Tag[]>()
  for (const tag of tags) {
    const key = tag.tag_group_id
    const list = byGroup.get(key) ?? []
    list.push(tag)
    byGroup.set(key, list)
  }

  const sections: TagLibrarySection[] = tagGroups.map((tagGroup) => ({
    tagGroup,
    roots: buildTagTree(byGroup.get(tagGroup.id) ?? [])
  }))

  sections.push({
    tagGroup: null,
    roots: buildTagTree(byGroup.get(null) ?? [])
  })

  return sections
}

export function compareTagsForSort(a: Tag, b: Tag): number {
  const byOrder = a.sort_order - b.sort_order
  if (byOrder !== 0) return byOrder
  return a.display_name.localeCompare(b.display_name, undefined, { sensitivity: 'base' })
}

/** Siblings share the same parent and tag group (manual sort scope in the library tree). */
export function getTagSiblings(tagId: number, tags: Tag[]): Tag[] {
  const tag = tags.find((t) => t.id === tagId)
  if (!tag) return []
  return tags
    .filter(
      (t) =>
        t.parent_id === tag.parent_id &&
        (t.tag_group_id ?? null) === (tag.tag_group_id ?? null)
    )
    .sort(compareTagsForSort)
}

function sortNodes(nodes: TagTreeNode[]) {
  nodes.sort((a, b) => compareTagsForSort(a.tag, b.tag))
  for (const n of nodes) sortNodes(n.children)
}

/** All tags whose parent chain starts at `rootId` (does not include `rootId`). */
export function collectDescendantIds(rootId: number, tags: Tag[]): number[] {
  const byParent = new Map<number, Tag[]>()
  for (const t of tags) {
    if (t.parent_id == null) continue
    const list = byParent.get(t.parent_id) ?? []
    list.push(t)
    byParent.set(t.parent_id, list)
  }
  const ids: number[] = []
  const queue = [rootId]
  while (queue.length > 0) {
    const parentId = queue.shift()!
    for (const child of byParent.get(parentId) ?? []) {
      ids.push(child.id)
      queue.push(child.id)
    }
  }
  return ids
}

function sameTagGroup(a: number | null | undefined, b: number | null | undefined): boolean {
  return (a ?? null) === (b ?? null)
}

export function isDescendantOf(ancestorId: number, nodeId: number, tags: Tag[]): boolean {
  let cur: number | null = nodeId
  while (cur != null) {
    if (cur === ancestorId) return true
    cur = tags.find((t) => t.id === cur)?.parent_id ?? null
  }
  return false
}

export function canReparentTag(
  draggedId: number,
  newParentId: number | null,
  tags: Tag[]
): boolean {
  if (newParentId == null) {
    const tag = tags.find((t) => t.id === draggedId)
    return tag?.parent_id != null
  }
  if (newParentId === draggedId) return false
  if (isDescendantOf(draggedId, newParentId, tags)) return false
  const tag = tags.find((t) => t.id === draggedId)
  const parent = tags.find((t) => t.id === newParentId)
  if (!tag || !parent) return false
  if (tag.parent_id === newParentId) return false
  return true
}

export function canAssignTagToGroup(
  draggedId: number,
  tagGroupId: number | null,
  tags: Tag[]
): boolean {
  const tag = tags.find((t) => t.id === draggedId)
  if (!tag) return false
  if (tag.parent_id != null) return true
  if (!sameTagGroup(tag.tag_group_id, tagGroupId)) return true
  return collectDescendantIds(draggedId, tags).some((id) => {
    const child = tags.find((t) => t.id === id)
    return child != null && !sameTagGroup(child.tag_group_id, tagGroupId)
  })
}
