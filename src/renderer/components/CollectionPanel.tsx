import { useCallback, useEffect, useState } from 'react'
import type { Collection, CollectionExternalLink, Tag } from '../../shared/types'
import { useAppStore } from '../store/appStore'
import { WikiEditor } from './WikiEditor'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { CollectionPrincipalTagsSection } from './CollectionPrincipalTagsSection'
import { CollectionExternalLinksSection } from './CollectionExternalLinksSection'

interface Props {
  collectionId: number
}

export function CollectionPanel({ collectionId }: Props) {
  const [collection, setCollection] = useState<Collection | null>(null)
  const [principal, setPrincipal] = useState<Tag[]>([])
  const [links, setLinks] = useState<CollectionExternalLink[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  const selectTag = useAppStore((s) => s.selectTag)
  const collectionDetailsRevision = useAppStore((s) => s.collectionDetailsRevision)
  const bumpCollectionDetailsRevision = useAppStore((s) => s.bumpCollectionDetailsRevision)
  const refreshCollections = useAppStore((s) => s.refreshCollections)
  const refreshMedia = useAppStore((s) => s.refreshMedia)
  const setSelectedCollectionId = useAppStore((s) => s.setSelectedCollectionId)
  const setDetailsFocus = useAppStore((s) => s.setDetailsFocus)

  const load = useCallback(async () => {
    setCollection((await window.collectionXiewer.collections.get(collectionId)) ?? null)
    setPrincipal(await window.collectionXiewer.collections.principalTags(collectionId))
    setLinks(await window.collectionXiewer.collections.externalLinks(collectionId))
  }, [collectionId])

  useEffect(() => {
    void load()
  }, [load, collectionDetailsRevision])

  if (!collection) return null

  const update = async (patch: { name?: string; description_md?: string }) => {
    const updated = await window.collectionXiewer.collections.update(collectionId, patch)
    setCollection(updated)
    await refreshCollections()
  }

  const deleteCollection = async () => {
    await window.collectionXiewer.collections.delete(collectionId)
    setSelectedCollectionId(null)
    setDetailsFocus('media')
    await refreshCollections()
    await refreshMedia()
  }

  const onSearchTags = (q: string) => window.collectionXiewer.tags.search(q)

  return (
    <div className="collection-panel">
      <div className="field">
        <label htmlFor="collection-name">Name</label>
        <input
          id="collection-name"
          value={collection.name}
          onChange={(e) => setCollection({ ...collection, name: e.target.value })}
          onBlur={() => {
            const trimmed = collection.name.trim()
            if (trimmed) void update({ name: trimmed })
          }}
        />
      </div>

      <div className="field">
        <label htmlFor="collection-desc">Description</label>
        <textarea
          id="collection-desc"
          rows={3}
          value={collection.description_md ?? ''}
          placeholder="Optional notes about this collection…"
          onChange={(e) => setCollection({ ...collection, description_md: e.target.value })}
          onBlur={() => void update({ description_md: collection.description_md ?? '' })}
        />
      </div>

      <CollectionPrincipalTagsSection
        collectionId={collectionId}
        tags={principal}
        onSelectTag={selectTag}
        onChanged={() => bumpCollectionDetailsRevision()}
        onSearchTags={onSearchTags}
      />

      <CollectionExternalLinksSection
        collection={collection}
        links={links}
        onLinksChange={setLinks}
      />

      <WikiEditor entityType="collection" entityId={collectionId} />

      <div className="collection-panel__actions">
        <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>
          Delete collection
        </button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete collection"
          message={`Delete “${collection.name}”? Media files stay on disk.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void deleteCollection()}
        />
      )}
    </div>
  )
}
