import { useCallback, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { isUniversalSubjectLabel } from '../../shared/subjects'
import { BulkApplyTagModal } from './BulkApplyTagModal'

export function BulkTagBar() {
  const selectedMediaIds = useAppStore((s) => s.selectedMediaIds)
  const clearMediaSelection = useAppStore((s) => s.clearMediaSelection)
  const mainView = useAppStore((s) => s.mainView)
  const [modalOpen, setModalOpen] = useState(false)
  const [subjectLabelHints, setSubjectLabelHints] = useState<string[]>([])

  const openModal = useCallback(async () => {
    const labels = new Set<string>()
    for (const mediaId of selectedMediaIds.slice(0, 50)) {
      const subjects = await window.collectionXiewer.subjects.list(mediaId)
      for (const s of subjects) {
        if (!isUniversalSubjectLabel(s.label)) labels.add(s.label)
      }
    }
    setSubjectLabelHints([...labels].sort((a, b) => a.localeCompare(b)))
    setModalOpen(true)
  }, [selectedMediaIds])

  if (mainView !== 'gallery' || selectedMediaIds.length === 0) return null

  return (
    <>
      <div className="bulk-tag-bar" role="status">
        <span className="bulk-tag-bar__count">{selectedMediaIds.length} selected</span>
        <button type="button" className="primary" onClick={() => void openModal()}>
          Apply tag…
        </button>
        <button type="button" onClick={clearMediaSelection}>
          Clear selection
        </button>
      </div>
      {modalOpen ? (
        <BulkApplyTagModal
          mediaIds={selectedMediaIds}
          subjectLabelHints={subjectLabelHints}
          onClose={() => setModalOpen(false)}
          onDone={() => setModalOpen(false)}
        />
      ) : null}
    </>
  )
}
