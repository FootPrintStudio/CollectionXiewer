import { useAppStore } from '../store/appStore'

/** Applies a tag to a specific subject on a media item. */
export async function applyTagToSubject(
  mediaId: number,
  tagId: number,
  subjectId: number
): Promise<void> {
  await window.collectionXiewer.subjects.ensure(mediaId)
  await window.collectionXiewer.mediaTags.apply(mediaId, tagId, subjectId)
  const store = useAppStore.getState()
  store.setSelectedMediaId(mediaId)
  store.bumpMediaTagsRevision()
}

/** Applies a tag to the permanent Universal subject. */
export async function applyTagToUniversalSubject(mediaId: number, tagId: number): Promise<void> {
  const universalId = await window.collectionXiewer.subjects.ensure(mediaId)
  await applyTagToSubject(mediaId, tagId, universalId)
}
