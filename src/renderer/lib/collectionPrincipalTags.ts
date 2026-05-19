import type { Tag } from '../../shared/types'

export async function addPrincipalTagToCollection(
  collectionId: number,
  tagId: number
): Promise<void> {
  const existing = (await window.collectionXiewer.collections.principalTags(
    collectionId
  )) as Tag[]
  const ids = existing.map((t) => t.id)
  if (ids.includes(tagId)) return
  await window.collectionXiewer.collections.setPrincipalTags(collectionId, [...ids, tagId])
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
