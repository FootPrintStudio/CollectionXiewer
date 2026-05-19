import { create } from 'zustand'
import type {
  CollectionMember,
  CollectionWithStats,
  GalleryViewMode,
  MediaItem,
  MediaSortOrder,
  Tag,
  TagGroup,
  DetailsFocus,
  WatchRoot
} from '../../shared/types'
import type { SearchNode } from '../../shared/searchAst'
import { defaultSearchAst, isEmptySearchAst } from '../../shared/searchAst'
import {
  clampGridSize,
  loadGalleryMode,
  loadGridSize,
  saveGalleryMode,
  saveGridSize
} from '../lib/galleryLayout'
import { loadMediaSortOrder, saveMediaSortOrder } from '../lib/mediaSortPrefs'
import { loadSlideshowIntervalSec, saveSlideshowIntervalSec } from '../lib/slideshowPrefs'
import {
  loadShowIdentifiers,
  loadShowThumbTagList,
  saveShowIdentifiers,
  saveShowThumbTagList
} from '../lib/displayPrefs'
import { rangeBetweenIds, toggleIdInList } from '../lib/mediaSelection'
import { slideshowEligibleMedia } from '../lib/slideshowMedia'

const api = () => window.collectionXiewer

interface AppState {
  galleryMode: GalleryViewMode
  gridSize: number
  mediaSortOrder: MediaSortOrder
  roots: WatchRoot[]
  collections: CollectionWithStats[]
  collectionMembersRevision: number
  collectionDetailsRevision: number
  tags: Tag[]
  tagGroups: TagGroup[]
  media: MediaItem[]
  selectedMediaId: number | null
  selectedMediaIds: number[]
  selectionAnchorId: number | null
  selectedTagId: number | null
  selectedCollectionId: number | null
  searchQueryText: string
  searchAst: SearchNode
  cropMode: boolean
  mainView: 'gallery' | 'preview' | 'board'
  detailsFocus: DetailsFocus
  mediaTagsRevision: number
  slideshowOpen: boolean
  slideshowIndex: number
  slideshowPlaying: boolean
  slideshowIntervalSec: number
  showThumbTagList: boolean
  showIdentifiers: boolean
  identifiersRevision: number
  setShowThumbTagList: (on: boolean) => void
  setShowIdentifiers: (on: boolean) => void
  bumpIdentifiersRevision: () => void
  setGalleryMode: (m: GalleryViewMode) => void
  setGridSize: (n: number) => void
  setMediaSortOrder: (order: MediaSortOrder) => void
  setSelectedMediaId: (id: number | null) => void
  selectMediaItem: (
    id: number,
    opts?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }
  ) => void
  setSelectedMediaIds: (ids: number[]) => void
  clearMediaSelection: () => void
  isMediaSelected: (id: number) => boolean
  setSelectedTagId: (id: number | null) => void
  setSelectedCollectionId: (id: number | null) => void
  setSearchQuery: (text: string, ast: SearchNode) => void
  setCropMode: (v: boolean) => void
  setMainView: (v: 'gallery' | 'preview' | 'board') => void
  setDetailsFocus: (v: DetailsFocus) => void
  openPreview: (mediaId: number) => void
  closePreview: () => void
  openSlideshow: () => void
  closeSlideshow: () => void
  setSlideshowIndex: (index: number) => void
  setSlideshowPlaying: (playing: boolean) => void
  setSlideshowIntervalSec: (sec: number) => void
  selectTag: (tagId: number | null) => void
  refreshRoots: () => Promise<void>
  refreshCollections: () => Promise<void>
  refreshTags: () => Promise<void>
  refreshTagGroups: () => Promise<void>
  refreshMedia: () => Promise<void>
  bumpMediaTagsRevision: () => void
  bumpCollectionMembersRevision: () => void
  bumpCollectionDetailsRevision: () => void
  init: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  galleryMode: loadGalleryMode(),
  gridSize: loadGridSize(),
  mediaSortOrder: loadMediaSortOrder(),
  roots: [],
  collections: [],
  collectionMembersRevision: 0,
  collectionDetailsRevision: 0,
  tags: [],
  tagGroups: [],
  media: [],
  selectedMediaId: null,
  selectedMediaIds: [],
  selectionAnchorId: null,
  selectedTagId: null,
  selectedCollectionId: null,
  searchQueryText: '',
  searchAst: defaultSearchAst,
  cropMode: false,
  mainView: 'gallery',
  detailsFocus: 'media',
  mediaTagsRevision: 0,
  slideshowOpen: false,
  slideshowIndex: 0,
  slideshowPlaying: true,
  slideshowIntervalSec: loadSlideshowIntervalSec(),
  showThumbTagList: loadShowThumbTagList(),
  showIdentifiers: loadShowIdentifiers(),
  identifiersRevision: 0,

  setGalleryMode: (galleryMode) => {
    set({ galleryMode })
    saveGalleryMode(galleryMode)
  },
  setGridSize: (gridSize) => {
    const next = clampGridSize(gridSize)
    set({ gridSize: next })
    saveGridSize(next)
  },
  setMediaSortOrder: (mediaSortOrder) => {
    set({ mediaSortOrder })
    saveMediaSortOrder(mediaSortOrder)
    void get().refreshMedia()
  },
  setSelectedMediaId: (selectedMediaId) =>
    set({
      selectedMediaId,
      selectedMediaIds: selectedMediaId != null ? [selectedMediaId] : [],
      selectionAnchorId: selectedMediaId,
      cropMode: false,
      ...(selectedMediaId != null ? { detailsFocus: 'media' as const } : {})
    }),

  selectMediaItem: (id, opts = {}) => {
    const { shiftKey = false, ctrlKey = false, metaKey = false } = opts
    const additive = ctrlKey || metaKey
    const { media, selectedMediaIds, selectionAnchorId, selectedMediaId } = get()
    const orderedIds = media.map((m) => m.id)
    const anchor = selectionAnchorId ?? selectedMediaId

    let nextIds: number[]
    if (shiftKey && anchor != null) {
      nextIds = rangeBetweenIds(orderedIds, anchor, id)
    } else if (additive) {
      nextIds = toggleIdInList(selectedMediaIds, id)
    } else {
      nextIds = [id]
    }

    set({
      selectedMediaIds: nextIds,
      selectedMediaId: id,
      selectionAnchorId: shiftKey ? anchor : id,
      cropMode: false,
      detailsFocus: 'media'
    })
  },

  setSelectedMediaIds: (selectedMediaIds) => {
    const primary = selectedMediaIds[selectedMediaIds.length - 1] ?? null
    set({
      selectedMediaIds,
      selectedMediaId: primary,
      selectionAnchorId: selectedMediaIds[0] ?? null,
      ...(primary != null ? { detailsFocus: 'media' as const } : {})
    })
  },

  clearMediaSelection: () =>
    set({
      selectedMediaIds: [],
      selectedMediaId: null,
      selectionAnchorId: null
    }),

  isMediaSelected: (id) => get().selectedMediaIds.includes(id),
  setSelectedTagId: (selectedTagId) => set({ selectedTagId }),
  setMainView: (mainView) => set({ mainView }),
  setDetailsFocus: (detailsFocus) => set({ detailsFocus }),
  openPreview: (mediaId) =>
    set({
      selectedMediaId: mediaId,
      selectedMediaIds: [mediaId],
      selectionAnchorId: mediaId,
      mainView: 'preview',
      detailsFocus: 'media',
      selectedTagId: null,
      cropMode: false
    }),
  closePreview: () => set({ mainView: 'gallery', cropMode: false }),
  openSlideshow: () => {
    const { media, selectedMediaId } = get()
    const slideshowItems = slideshowEligibleMedia(media)
    if (slideshowItems.length === 0) return
    const idx =
      selectedMediaId != null
        ? slideshowItems.findIndex((m) => m.id === selectedMediaId)
        : 0
    set({
      slideshowOpen: true,
      slideshowIndex: idx >= 0 ? idx : 0,
      slideshowPlaying: true
    })
  },
  closeSlideshow: () => set({ slideshowOpen: false, slideshowPlaying: false }),
  setSlideshowIndex: (slideshowIndex) => set({ slideshowIndex }),
  setSlideshowPlaying: (slideshowPlaying) => set({ slideshowPlaying }),
  setSlideshowIntervalSec: (slideshowIntervalSec) => {
    saveSlideshowIntervalSec(slideshowIntervalSec)
    set({ slideshowIntervalSec })
  },
  setShowThumbTagList: (showThumbTagList) => {
    saveShowThumbTagList(showThumbTagList)
    set({ showThumbTagList })
  },
  setShowIdentifiers: (showIdentifiers) => {
    saveShowIdentifiers(showIdentifiers)
    set({ showIdentifiers })
  },
  bumpIdentifiersRevision: () =>
    set((s) => ({ identifiersRevision: s.identifiersRevision + 1 })),
  selectTag: (tagId) =>
    set({
      selectedTagId: tagId,
      detailsFocus: tagId !== null ? 'tag' : useAppStore.getState().detailsFocus
    }),
  setSelectedCollectionId: (selectedCollectionId) => set({ selectedCollectionId }),
  setSearchQuery: (searchQueryText, searchAst) => set({ searchQueryText, searchAst }),
  setCropMode: (cropMode) => set({ cropMode }),
  bumpMediaTagsRevision: () => set((s) => ({ mediaTagsRevision: s.mediaTagsRevision + 1 })),
  bumpCollectionMembersRevision: () =>
    set((s) => ({ collectionMembersRevision: s.collectionMembersRevision + 1 })),
  bumpCollectionDetailsRevision: () =>
    set((s) => ({ collectionDetailsRevision: s.collectionDetailsRevision + 1 })),

  refreshRoots: async () => {
    const roots = await api().roots.list()
    set({ roots })
  },
  refreshCollections: async () => {
    const collections = await api().collections.list()
    set({ collections })
  },
  refreshTags: async () => {
    const tags = await api().tags.list()
    set({ tags })
  },
  refreshTagGroups: async () => {
    const tagGroups = await api().tagGroups.list()
    set({ tagGroups })
  },
  refreshMedia: async () => {
    const { searchAst, selectedCollectionId, mediaSortOrder } = get()
    const hasSearchFilters = !isEmptySearchAst(searchAst)

    let media: MediaItem[]
    if (hasSearchFilters) {
      media = await api().media.search(searchAst, 1000, 0, mediaSortOrder)
    } else if (selectedCollectionId) {
      media = await api().media.list({
        collectionId: selectedCollectionId,
        limit: 1000,
        sortOrder: mediaSortOrder
      })
    } else {
      media = await api().media.list({ limit: 1000, sortOrder: mediaSortOrder })
    }

    if (hasSearchFilters && selectedCollectionId) {
      const members = await api().collections.members(selectedCollectionId)
      const memberIds = new Set(members.map((m: CollectionMember) => m.media_id))
      media = media.filter((m) => memberIds.has(m.id))
    }

    const idSet = new Set(media.map((m) => m.id))
    const { selectedMediaIds, selectedMediaId, selectionAnchorId } = get()
    const nextIds = selectedMediaIds.filter((mid: number) => idSet.has(mid))
    const nextPrimary =
      selectedMediaId != null && idSet.has(selectedMediaId)
        ? selectedMediaId
        : (nextIds[nextIds.length - 1] ?? null)
    const nextAnchor =
      selectionAnchorId != null && idSet.has(selectionAnchorId)
        ? selectionAnchorId
        : (nextIds[0] ?? null)

    set({
      media,
      selectedMediaIds: nextIds,
      selectedMediaId: nextPrimary,
      selectionAnchorId: nextAnchor
    })
  },

  init: async () => {
    await get().refreshRoots()
    await get().refreshCollections()
    await get().refreshTags()
    await get().refreshTagGroups()
    await get().refreshMedia()
  }
}))
