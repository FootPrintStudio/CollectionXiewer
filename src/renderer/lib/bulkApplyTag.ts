import { useAppStore } from '../store/appStore'

export type BulkApplySubject =
  | { mode: 'universal' }
  | { mode: 'label'; label: string }

export async function bulkApplyTagToSelection(
  mediaIds: number[],
  tagId: number,
  subject: BulkApplySubject
): Promise<{ applied: number; skipped: number }> {
  const result = await window.collectionXiewer.mediaTags.bulkApply(mediaIds, tagId, subject)
  const store = useAppStore.getState()
  store.bumpMediaTagsRevision()
  await store.refreshMedia()
  return result
}
