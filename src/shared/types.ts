export type MediaKind = 'image' | 'video' | 'motion' | 'unknown'

export type MediaSortOrder = 'name' | 'date_added' | 'date_modified'

export interface WatchRoot {
  id: number
  path: string
  enabled: number
  last_scan_at: string | null
}

export interface MediaItem {
  id: number
  root_id: number
  relative_path: string
  absolute_path: string
  mime: string | null
  kind: MediaKind
  width: number | null
  height: number | null
  duration_ms: number | null
  mtime: number
  indexed_at: string
  missing: number
}

export interface MediaCrop {
  media_id: number
  x: number
  y: number
  w: number
  h: number
  updated_at: string
}

export interface TagGroup {
  id: number
  label: string
  sort_order: number
  color: string | null
  icon: string | null
}

export interface Tag {
  id: number
  slug: string
  display_name: string
  disambiguator: string | null
  parent_id: number | null
  tag_group_id: number | null
  sort_order: number
  color: string | null
  use_custom_color: boolean
  icon: string | null
  use_custom_icon: boolean
  description_md: string | null
  created_at: string
}

export interface TagConnection {
  id: number
  source_tag_id: number
  target_tag_id: number
  kind: 'hard' | 'soft'
}

export interface TagExternalLink {
  id: number
  tag_id: number
  label: string
  url: string
}

export interface CollectionExternalLink {
  id: number
  collection_id: number
  label: string
  url: string
}

export interface Subject {
  id: number
  media_id: number
  label: string
  sort_order: number
  region_x: number | null
  region_y: number | null
  region_w: number | null
  region_h: number | null
}

export interface SubjectUpdatePatch {
  label?: string
  region?: CropRect | null
}

export interface MediaTag {
  media_id: number
  tag_id: number
  subject_id: number | null
  tag?: Tag
}

/** Persisted soft-link suggestion on a media item within a subject. */
export interface Identifier {
  id: number
  label: string
  icon: string
  color: string
  query_text: string
  query_ast: string
  sort_order: number
  enabled: number
}

export interface IdentifierBadge {
  identifierId: number
  label: string
  icon: string
  color: string
  query_text: string
}

export interface MediaTagSuggestion {
  media_id: number
  subject_id: number
  tag_id: number
  source_tag_id: number
  tag?: Tag
}

export interface Collection {
  id: number
  name: string
  description_md: string | null
  created_at: string
  sort_order: number
}

export interface CollectionWithStats extends Collection {
  member_count: number
}

export interface CollectionMember {
  collection_id: number
  media_id: number
  sort_key: string
}

export interface WikiPage {
  entity_type: 'tag' | 'media' | 'collection'
  entity_id: number
  body_md: string
  updated_at: string
}

export interface SavedSearch {
  id: number
  name: string
  query_json: string
}

export interface TagDisplay extends Tag {
  label: string
}

export interface MediaListQuery {
  rootId?: number
  collectionId?: number
  tagIds?: number[]
  tagMode?: 'any' | 'all'
  excludeTagIds?: number[]
  kinds?: MediaKind[]
  searchText?: string
  sortOrder?: MediaSortOrder
  limit?: number
  offset?: number
}

export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

export type GalleryViewMode = 'grid' | 'masonry' | 'horizontal'

export type DetailsFocus = 'media' | 'tag' | 'collection'
