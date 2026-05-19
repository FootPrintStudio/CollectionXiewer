import { useAppStore } from '../store/appStore'
import { TagPanel } from './TagPanel'
import { MediaDetailsPanel } from './MediaDetailsPanel'
import { CollectionPanel } from './CollectionPanel'

export function DetailsPanel() {
  const detailsFocus = useAppStore((s) => s.detailsFocus)
  const selectedTagId = useAppStore((s) => s.selectedTagId)
  const selectedMediaId = useAppStore((s) => s.selectedMediaId)
  const selectedCollectionId = useAppStore((s) => s.selectedCollectionId)
  const mainView = useAppStore((s) => s.mainView)
  const setDetailsFocus = useAppStore((s) => s.setDetailsFocus)

  const showMedia = detailsFocus === 'media' && selectedMediaId !== null
  const showTag = detailsFocus === 'tag' && selectedTagId !== null
  const showCollection = detailsFocus === 'collection' && selectedCollectionId !== null

  return (
    <aside className="details-panel">
      <h2 className="panel-chrome-title">Details Panel</h2>

      {mainView === 'preview' && selectedMediaId && (
        <div className="details-panel-tabs">
          <button
            type="button"
            className={detailsFocus === 'media' ? 'primary' : ''}
            onClick={() => setDetailsFocus('media')}
          >
            Media
          </button>
          <button
            type="button"
            className={detailsFocus === 'tag' ? 'primary' : ''}
            onClick={() => selectedTagId && setDetailsFocus('tag')}
            disabled={!selectedTagId}
          >
            Tag
          </button>
          <button
            type="button"
            className={detailsFocus === 'collection' ? 'primary' : ''}
            onClick={() => selectedCollectionId && setDetailsFocus('collection')}
            disabled={!selectedCollectionId}
          >
            Collection
          </button>
        </div>
      )}

      {showMedia && <MediaDetailsPanel />}
      {showTag && <TagPanel />}
      {showCollection && selectedCollectionId != null && (
        <CollectionPanel collectionId={selectedCollectionId} />
      )}
      {!showMedia && !showTag && !showCollection && (
        <p className="empty-hint">
          {mainView === 'preview'
            ? 'Double-click a thumbnail to preview. Select media, a tag, or a collection in the Library Panel.'
            : 'Select media, a tag, or a collection to view details.'}
        </p>
      )}
    </aside>
  )
}
