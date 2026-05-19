import { useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FolderOpen, GripVertical } from 'lucide-react'
import type { Collection, CollectionWithStats } from '../../shared/types'
import { useAppStore } from '../store/appStore'
import { useTagDnd } from '../dnd/TagDndContext'
import { useCollectionDrop } from '../dnd/useCollectionDrop'
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { NewCollectionModal } from '../ui/NewCollectionModal'

function SortableCollectionRow({
  collection,
  active,
  reorderEnabled,
  onSelect,
  onContextMenu
}: {
  collection: CollectionWithStats
  active: boolean
  reorderEnabled: boolean
  onSelect: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const { setNodeRef: setDropRef, isDropHover } = useCollectionDrop(collection.id)
  const {
    attributes,
    listeners,
    setNodeRef: setSortRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: collection.id,
    disabled: !reorderEnabled
  })

  const setRefs = (el: HTMLDivElement | null) => {
    setDropRef(el)
    setSortRef(el)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div
      ref={setRefs}
      style={style}
      role="button"
      tabIndex={0}
      className={`list-item collections-library__item${active ? ' active' : ''}${isDropHover ? ' collection-drop-hover' : ''}${isDragging ? ' collections-library__item--dragging' : ''}`}
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
      {reorderEnabled ? (
        <button
          type="button"
          className="collections-library__drag-handle"
          aria-label={`Reorder ${collection.name}`}
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} aria-hidden />
        </button>
      ) : null}
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
  const [orderedIds, setOrderedIds] = useState<number[]>([])

  const reorderEnabled = !query.trim()

  const displayed = useMemo(() => {
    if (!query.trim()) return collections
    return searchResults ?? collections
  }, [collections, query, searchResults])

  const sortableIds = useMemo(() => {
    if (!reorderEnabled) return []
    if (orderedIds.length === collections.length && collections.every((c) => orderedIds.includes(c.id))) {
      return orderedIds
    }
    return collections.map((c) => c.id)
  }, [collections, orderedIds, reorderEnabled])

  const displayedById = useMemo(() => {
    if (!reorderEnabled) return displayed
    const map = new Map(collections.map((c) => [c.id, c]))
    return sortableIds.map((id) => map.get(id)).filter((c): c is CollectionWithStats => c != null)
  }, [reorderEnabled, displayed, collections, sortableIds])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sortableIds.indexOf(Number(active.id))
    const newIndex = sortableIds.indexOf(Number(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(sortableIds, oldIndex, newIndex)
    setOrderedIds(next)
    await window.collectionXiewer.collections.reorder(next)
    await refreshCollections()
  }

  const moveCollection = async (col: CollectionWithStats, direction: 'up' | 'down') => {
    await window.collectionXiewer.collections.move(col.id, direction)
    await refreshCollections()
    setOrderedIds([])
  }

  const menuItems: ContextMenuItem[] = menu
    ? [
        ...(reorderEnabled
          ? [
              {
                label: 'Move up',
                onClick: () => {
                  void moveCollection(menu.collection, 'up')
                  setMenu(null)
                }
              },
              {
                label: 'Move down',
                onClick: () => {
                  void moveCollection(menu.collection, 'down')
                  setMenu(null)
                }
              }
            ]
          : []),
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

  const listItems = reorderEnabled ? displayedById : displayed
  const listBody = listItems.map((c) => (
    <SortableCollectionRow
      key={c.id}
      collection={c}
      active={selectedCollectionId === c.id}
      reorderEnabled={reorderEnabled}
      onSelect={() => selectCollection(c.id)}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenu({ x: e.clientX, y: e.clientY, collection: c })
      }}
    />
  ))

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
          : reorderEnabled
            ? 'Drag collections to reorder. Drag thumbnails from the gallery onto a collection to add them.'
            : 'Drag thumbnails from the gallery and drop them on a collection below.'}
      </p>

      <button
        type="button"
        className={`list-item${selectedCollectionId === null ? ' active' : ''}`}
        onClick={() => selectCollection(null)}
      >
        All media
      </button>

      {reorderEnabled ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {listBody}
          </SortableContext>
        </DndContext>
      ) : (
        listBody
      )}

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
