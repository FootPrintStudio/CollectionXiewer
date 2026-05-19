import { useAppStore } from '../store/appStore'

export async function moveMediaTagToSubject(
  mediaId: number,
  tagId: number,
  fromSubjectId: number,
  toSubjectId: number
): Promise<void> {
  if (fromSubjectId === toSubjectId) return
  await window.collectionXiewer.mediaTags.move(mediaId, tagId, fromSubjectId, toSubjectId)
  useAppStore.getState().bumpMediaTagsRevision()
}
