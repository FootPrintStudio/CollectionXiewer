import type { MediaSortOrder } from './types'

export const MEDIA_SORT_ORDERS: MediaSortOrder[] = ['date_added', 'name', 'date_modified']

export const MEDIA_SORT_LABELS: Record<MediaSortOrder, string> = {
  date_added: 'Date added',
  name: 'Name',
  date_modified: 'Date modified'
}

export const MEDIA_SORT_DEFAULT: MediaSortOrder = 'name'

export function mediaSortOrderClause(sortOrder: MediaSortOrder = MEDIA_SORT_DEFAULT): string {
  switch (sortOrder) {
    case 'date_added':
      return 'm.indexed_at DESC, m.id DESC'
    case 'date_modified':
      return 'm.mtime DESC, m.id DESC'
    case 'name':
      return 'm.relative_path COLLATE NOCASE ASC'
    default:
      return 'm.relative_path COLLATE NOCASE ASC'
  }
}
