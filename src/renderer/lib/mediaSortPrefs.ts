import { MEDIA_SORT_DEFAULT, MEDIA_SORT_ORDERS } from '../../shared/mediaSort'
import type { MediaSortOrder } from '../../shared/types'

const STORAGE_MEDIA_SORT = 'collectionXiewer.mediaSortOrder'

export function loadMediaSortOrder(): MediaSortOrder {
  try {
    const raw = localStorage.getItem(STORAGE_MEDIA_SORT)
    if (raw && MEDIA_SORT_ORDERS.includes(raw as MediaSortOrder)) {
      return raw as MediaSortOrder
    }
  } catch {
    /* ignore */
  }
  return MEDIA_SORT_DEFAULT
}

export function saveMediaSortOrder(order: MediaSortOrder): void {
  try {
    localStorage.setItem(STORAGE_MEDIA_SORT, order)
  } catch {
    /* ignore */
  }
}
