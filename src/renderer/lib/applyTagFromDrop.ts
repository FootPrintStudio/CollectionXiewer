import type { Subject } from '../../shared/types'
import { isUniversalSubjectLabel } from '../../shared/subjects'
import { applyTagToSubject, applyTagToUniversalSubject } from './applyTagToMedia'
import { bulkApplyTagToSelection } from './bulkApplyTag'
import { useAppStore } from '../store/appStore'

export interface MediaTagDropTarget {
  mediaId: number
  subjectId?: number
}

/** Apply a library tag drop to media; bulk when dropped on a selected item. */
export async function applyTagFromLibraryDrop(
  tagId: number,
  dropTarget: MediaTagDropTarget
): Promise<void> {
  const { selectedMediaIds } = useAppStore.getState()
  const droppedOnSelected =
    selectedMediaIds.length > 0 && selectedMediaIds.includes(dropTarget.mediaId)

  if (droppedOnSelected) {
    const subject = await resolveBulkSubject(dropTarget)
    await bulkApplyTagToSelection(selectedMediaIds, tagId, subject)
    return
  }

  if (dropTarget.subjectId != null) {
    await applyTagToSubject(dropTarget.mediaId, tagId, dropTarget.subjectId)
  } else {
    await applyTagToUniversalSubject(dropTarget.mediaId, tagId)
  }
}

async function resolveBulkSubject(
  dropTarget: MediaTagDropTarget
): Promise<{ mode: 'universal' } | { mode: 'label'; label: string }> {
  if (dropTarget.subjectId == null) return { mode: 'universal' }
  const subjects = (await window.collectionXiewer.subjects.list(
    dropTarget.mediaId
  )) as Subject[]
  const subject = subjects.find((s: Subject) => s.id === dropTarget.subjectId)
  if (!subject || isUniversalSubjectLabel(subject.label)) {
    return { mode: 'universal' }
  }
  return { mode: 'label', label: subject.label }
}
