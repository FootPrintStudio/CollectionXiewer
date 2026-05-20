import type { Tag } from '../../shared/types'

export async function addPrincipalTagToCollection(
  collectionId: number,
  tagId: number
): Promise<Tag[]> {
  return window.collectionXiewer.collections.addPrincipalTag(collectionId, tagId)
}

export async function removePrincipalTagFromCollection(
  collectionId: number,
  tagId: number
): Promise<void> {
  const existing = (await window.collectionXiewer.collections.principalTags(
    collectionId
  )) as Tag[]
  const ids = existing.filter((t) => t.id !== tagId).map((t) => t.id)
  await window.collectionXiewer.collections.setPrincipalTags(collectionId, ids)
}

export async function loadPrincipalTagSuggestions(collectionId: number): Promise<Tag[]> {
  return window.collectionXiewer.collections.principalTagSuggestions(collectionId)
}
