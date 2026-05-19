export const COLLECTION_DROP_PREFIX = 'collection-drop-'
export const COLLECTION_PRINCIPAL_DROP_PREFIX = 'collection-principal-drop-'

export function collectionDropId(collectionId: number): string {
  return `${COLLECTION_DROP_PREFIX}${collectionId}`
}

export function collectionPrincipalDropId(collectionId: number): string {
  return `${COLLECTION_PRINCIPAL_DROP_PREFIX}${collectionId}`
}

export function parseCollectionPrincipalDropId(id: string | number): number | null {
  const s = String(id)
  if (!s.startsWith(COLLECTION_PRINCIPAL_DROP_PREFIX)) return null
  const n = Number(s.slice(COLLECTION_PRINCIPAL_DROP_PREFIX.length))
  return Number.isFinite(n) ? n : null
}

export function parseCollectionDropId(id: string | number): number | null {
  const s = String(id)
  if (!s.startsWith(COLLECTION_DROP_PREFIX)) return null
  const n = Number(s.slice(COLLECTION_DROP_PREFIX.length))
  return Number.isFinite(n) ? n : null
}

export function mediaDragId(mediaId: number): string {
  return `media-drag-${mediaId}`
}

export function parseMediaDragId(id: string | number): number | null {
  const s = String(id)
  if (!s.startsWith('media-drag-')) return null
  const n = Number(s.slice('media-drag-'.length))
  return Number.isFinite(n) ? n : null
}

export type MediaDragData = { type: 'media'; mediaId: number; mediaIds: number[] }
