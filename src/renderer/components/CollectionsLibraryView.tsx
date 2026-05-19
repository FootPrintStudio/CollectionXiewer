import { useMemo, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import type { Collection, CollectionWithStats } from '../../shared/types'
import { useAppStore } from '../store/appStore'
import { useTagDnd } from '../dnd/TagDndContext'
import { useCollectionDrop } from '../dnd/useCollectionDrop'
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { NewCollectionModal } from '../ui/NewCollectionModal'

function CollectionRow({
  collection,
  active,
  onSelect,
  onContextMenu
}: {
  collection: CollectionWithStats
  active: boolean
  onSelect: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const { setNodeRef, isDropHover } = useCollectionDrop(collection.id)

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      className={`list-item collections-library__item${active ? ' active' : ''}${isDropHover ? ' collection-drop-hover' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      onContextMenu={onContextMenu}
      title={`${collection.description_md ?? collection.name} — drop media here to add`}
    >
      <FolderOpen size={14} className="collections-library__icon" aria-hidden />
      <span className="collections-library__label">{collection.name}</span>
      <span className="collections-library__count">{collection.member_count}</span>
    </div>
  )
}

export function CollectionsLibraryView() {
  const collections = useAppStore((s) => s.collections)
  const selectedCollectionId = useAppStore((s) => s.selectedCollectionId)
  const setSelectedCollectionId = useAppStore((s) => s.setSelectedCollectionId)
  const setDetailsFocus = useAppStore((s) => s.setDetailsFocus)
  const refreshCollections = useAppStore((s) => s.refreshCollections)
  const refreshMedia = useAppStore((s) => s.refreshMedia)
  const { draggingMediaIds } = useTagDnd()
  const isMediaDrag = draggingMediaIds.length > 0

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CollectionWithStats[] | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; collection: CollectionWithStats } | null>(
    null
  )
  const [confirmDelete, setConfirmDelete] = useState<CollectionWithStats | null>(null)

  const displayed = useMemo(() => {
    if (!query.trim()) return collections
    return searchResults ?? collections
  }, [collections, query, searchResults])

  const runSearch = async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) {
      setSearchResults(null)
      return
    }
    const results = (await window.collectionXiewer.collections.search(trimmed)) as Collection[]
    const counts = new Map(collections.map((c) => [c.id, c.member_count]))
    setSearchResults(
      results.map((c: Collection) => ({ ...c, member_count: counts.get(c.id) ?? 0 }))
    )
  }

  const selectCollection = (id: number | null) => {
    setSelectedCollectionId(id)
    if (id != null) setDetailsFocus('collection')
    void refreshMedia()
  }

  const onCreated = async () => {
    await refreshCollections()
  }

  const deleteCollection = async (col: CollectionWithStats) => {
    await window.collectionXiewer.collections.delete(col.id)
    if (selectedCollectionId === col.id) {
      setSelectedCollectionId(null)
      setDetailsFocus('media')
    }
    await refreshCollections()
    await refreshMedia()
  }

  const menuItems: ContextMenuItem[] = menu
    ? [
        {
          label: 'Rename…',
          onClick: () => {
            const next = prompt('Collection name', menu.collection.name)
            if (next?.trim()) {
              void window.collectionXiewer.collections
                .update(menu.collection.id, { name: next.trim() })
                .then(refreshCollections)
            }
            setMenu(null)
          }
        },
        {
          label: 'Delete collection',
          danger: true,
          onClick: () => {
            setConfirmDelete(menu.collection)
            setMenu(null)
          }
        }
      ]
    : []

  return (
    <div className={`collections-library${isMediaDrag ? ' collections-library--drop-active' : ''}`}>
      <button
        type="button"
        className="primary"
        style={{ width: '100%', marginBottom: '0.5rem' }}
        onClick={() => setShowNew(true)}
      >
        + New collection
      </button>

      <input
        type="search"
        className="collections-library__search"
        placeholder="Search collections…"
        value={query}
        onChange={(e) => {
          const v = e.target.value
          setQuery(v)
          void runSearch(v)
        }}
        aria-label="Search collections"
      />

      <p className="collections-library__hint">
        {isMediaDrag
          ? 'Drop on a collection below to add the selected media.'
          : 'Drag thumbnails from the gallery and drop them on a collection below.'}
      </p>

      <button
        type="button"
        className={`list-item${selectedCollectionId === null ? ' active' : ''}`}
        onClick={() => selectCollection(null)}
      >
        All media
      </button>

      {displayed.map((c) => (
        <CollectionRow
          key={c.id}
          collection={c}
          active={selectedCollectionId === c.id}
          onSelect={() => selectCollection(c.id)}
          onContextMenu={(e) => {
            e.preventDefault()
            setMenu({ x: e.clientX, y: e.clientY, collection: c })
          }}
        />
      ))}

      {displayed.length === 0 && query.trim() ? (
        <p className="empty-hint">No collections match your search.</p>
      ) : null}

      {showNew && (
        <NewCollectionModal
          onClose={() => setShowNew(false)}
          onCreated={(col) => {
            void onCreated().then(() => selectCollection(col.id))
          }}
        />
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete collection"
          message={`Delete “${confirmDelete.name}”? Media files are not deleted—only this album.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            void deleteCollection(confirmDelete)
            setConfirmDelete(null)
          }}
        />
      )}
    </div>
  )
}
