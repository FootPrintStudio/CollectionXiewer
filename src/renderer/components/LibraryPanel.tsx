import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useTagDnd } from '../dnd/TagDndContext'
import { TagTreeView } from './TagTreeView'
import { WatchRootTreeView } from './WatchRootTreeView'
import { CollectionsLibraryView } from './CollectionsLibraryView'

type LibraryTab = 'folders' | 'collections' | 'tags'

export function LibraryPanel() {
  const [tab, setTab] = useState<LibraryTab>('folders')
  const { draggingMediaIds } = useTagDnd()
  const wasDraggingMediaRef = useRef(false)
  const roots = useAppStore((s) => s.roots)
  const refreshRoots = useAppStore((s) => s.refreshRoots)
  const refreshMedia = useAppStore((s) => s.refreshMedia)

  useEffect(() => {
    const dragging = draggingMediaIds.length > 0
    if (dragging && !wasDraggingMediaRef.current) {
      setTab('collections')
    }
    wasDraggingMediaRef.current = dragging
  }, [draggingMediaIds])

  const addRoot = async () => {
    const path = await window.collectionXiewer.roots.pickFolder()
    if (path) {
      await window.collectionXiewer.roots.add(path)
      await refreshRoots()
      await refreshMedia()
    }
  }

  return (
    <aside className="library-panel">
      <h2 className="panel-chrome-title">Library Panel</h2>
      <div className="library-panel-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'folders'}
          className={tab === 'folders' ? 'primary' : ''}
          onClick={() => setTab('folders')}
        >
          Folders Library
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'collections'}
          className={tab === 'collections' ? 'primary' : ''}
          onClick={() => setTab('collections')}
        >
          Collections Library
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tags'}
          className={tab === 'tags' ? 'primary' : ''}
          onClick={() => setTab('tags')}
        >
          Tags Library
        </button>
      </div>

      <div
        className={`library-panel-tab-panel${tab === 'tags' ? ' library-panel-tab-panel--tags' : ''}`}
        role="tabpanel"
      >
        {tab === 'folders' && (
          <>
            <button
              type="button"
              className="primary"
              style={{ width: '100%', marginBottom: '0.5rem' }}
              onClick={() => void addRoot()}
            >
              + Add folder
            </button>
            <WatchRootTreeView
              roots={roots}
              onRescan={(id) => void window.collectionXiewer.roots.rescan(id).then(refreshMedia)}
            />
          </>
        )}

        {tab === 'collections' && <CollectionsLibraryView />}

        {tab === 'tags' && <TagTreeView />}
      </div>
    </aside>
  )
}
