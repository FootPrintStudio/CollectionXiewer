import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { showError } from '../store/toastStore'
import { useTagDnd } from '../dnd/TagDndContext'
import { TagTreeView } from './TagTreeView'
import { WatchRootTreeView } from './WatchRootTreeView'
import { CollectionsLibraryView } from './CollectionsLibraryView'
import { BoardsLibraryView } from './BoardsLibraryView'

type LibraryTab = 'folders' | 'collections' | 'boards' | 'tags'

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
    if (!path) return
    try {
      await window.collectionXiewer.roots.add(path)
      await refreshRoots()
      await refreshMedia()
    } catch (e) {
      showError(e)
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
          aria-selected={tab === 'boards'}
          className={tab === 'boards' ? 'primary' : ''}
          onClick={() => setTab('boards')}
        >
          Boards Library
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

        {tab === 'boards' && <BoardsLibraryView />}

        {tab === 'tags' && <TagTreeView />}
      </div>
    </aside>
  )
}
