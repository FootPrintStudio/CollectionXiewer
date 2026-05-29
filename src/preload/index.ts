import { contextBridge, ipcRenderer } from 'electron'
import type {
  CropRect,
  Identifier,
  IdentifierBadge,
  MediaListQuery,
  MediaSortOrder,
  MediaTagSuggestion,
  Tag,
  TagGroup,
  CollectionExternalLink
} from '../shared/types'
import type { SearchNode } from '../shared/searchAst'
import type { BoardDocument, BoardSummary } from '../shared/boardSchema'
import type { UpdaterStatus } from '../shared/updaterTypes'

const api = {
  roots: {
    list: () => ipcRenderer.invoke('roots:list'),
    add: (path: string) => ipcRenderer.invoke('roots:add', path),
    remove: (id: number) => ipcRenderer.invoke('roots:remove', id),
    rescan: (id: number) => ipcRenderer.invoke('roots:rescan', id),
    pickFolder: () => ipcRenderer.invoke('roots:pick-folder') as Promise<string | null>
  },
  media: {
    list: (query?: MediaListQuery) => ipcRenderer.invoke('media:list', query ?? {}),
    get: (id: number) => ipcRenderer.invoke('media:get', id),
    search: (ast: SearchNode, limit?: number, offset?: number, sortOrder?: MediaSortOrder) =>
      ipcRenderer.invoke('media:search', JSON.stringify(ast), limit, offset, sortOrder)
  },
  thumb: {
    get: (mediaId: number, size: number) => ipcRenderer.invoke('thumb:get', mediaId, size) as Promise<string | null>
  },
  preview: {
    get: (mediaId: number, maxDim: number) => ipcRenderer.invoke('preview:get', mediaId, maxDim) as Promise<string | null>
  },
  video: {
    setPoster: (mediaId: number, data: Uint8Array, timeMs: number) =>
      ipcRenderer.invoke('video:setPoster', mediaId, Buffer.from(data), timeMs),
    clearPoster: (mediaId: number) => ipcRenderer.invoke('video:clearPoster', mediaId),
    getPosterPath: (mediaId: number) =>
      ipcRenderer.invoke('video:getPosterPath', mediaId) as Promise<string | null>,
    getPosterTimeMs: (mediaId: number) =>
      ipcRenderer.invoke('video:getPosterTimeMs', mediaId) as Promise<number | null>,
    toolsAvailable: () => ipcRenderer.invoke('video:toolsAvailable') as Promise<boolean>
  },
  tags: {
    list: () => ipcRenderer.invoke('tags:list') as Promise<Tag[]>,
    get: (id: number) => ipcRenderer.invoke('tags:get', id),
    create: (input: {
      display_name: string
      disambiguator?: string | null
      parent_id?: number | null
      tag_group_id?: number | null
      color?: string | null
      use_custom_color?: boolean
      icon?: string | null
      use_custom_icon?: boolean
    }) => ipcRenderer.invoke('tags:create', input),
    update: (id: number, patch: Partial<Tag>) => ipcRenderer.invoke('tags:update', id, patch),
    setParent: (tagId: number, parentId: number | null) =>
      ipcRenderer.invoke('tags:set-parent', tagId, parentId),
    assignGroup: (tagId: number, tagGroupId: number | null) =>
      ipcRenderer.invoke('tags:assign-group', tagId, tagGroupId),
    move: (id: number, direction: 'up' | 'down') => ipcRenderer.invoke('tags:move', id, direction),
    sortChildrenAlphabetically: (parentTagId: number) =>
      ipcRenderer.invoke('tags:sort-children-alphabetically', parentTagId),
    sortGroupRootsAlphabetically: (tagGroupId: number | null) =>
      ipcRenderer.invoke('tags:sort-group-roots-alphabetically', tagGroupId),
    deleteImpact: (id: number) =>
      ipcRenderer.invoke('tags:delete-impact', id) as Promise<{ mediaCount: number; childCount: number }>,
    remove: (id: number) => ipcRenderer.invoke('tags:remove', id),
    search: (q: string) => ipcRenderer.invoke('tags:search', q) as Promise<Tag[]>,
    connections: (id: number) => ipcRenderer.invoke('tags:connections', id),
    addConnection: (sourceId: number, targetId: number, kind: 'hard' | 'soft') =>
      ipcRenderer.invoke('tags:add-connection', sourceId, targetId, kind),
    removeConnection: (id: number) => ipcRenderer.invoke('tags:remove-connection', id),
    externalLinks: (id: number) => ipcRenderer.invoke('tags:external-links', id),
    addExternalLink: (tagId: number, label: string, url: string) =>
      ipcRenderer.invoke('tags:add-external-link', tagId, label, url),
    updateExternalLink: (id: number, label: string, url: string) =>
      ipcRenderer.invoke('tags:update-external-link', id, label, url),
    removeExternalLink: (id: number) => ipcRenderer.invoke('tags:remove-external-link', id)
  },
  mediaTags: {
    list: (mediaId: number) => ipcRenderer.invoke('mediaTags:list', mediaId),
    listForMediaIds: (mediaIds: number[]) =>
      ipcRenderer.invoke('mediaTags:listForMediaIds', mediaIds) as Promise<Record<number, Tag[]>>,
    suggestions: (mediaId: number) =>
      ipcRenderer.invoke('mediaTags:suggestions', mediaId) as Promise<MediaTagSuggestion[]>,
    apply: (mediaId: number, tagId: number, subjectId: number | null) =>
      ipcRenderer.invoke('mediaTags:apply', mediaId, tagId, subjectId),
    remove: (mediaId: number, tagId: number, subjectId: number | null) =>
      ipcRenderer.invoke('mediaTags:remove', mediaId, tagId, subjectId),
    move: (mediaId: number, tagId: number, fromSubjectId: number, toSubjectId: number) =>
      ipcRenderer.invoke('mediaTags:move', mediaId, tagId, fromSubjectId, toSubjectId),
    bulkApply: (
      mediaIds: number[],
      tagId: number,
      subject: { mode: 'universal' } | { mode: 'label'; label: string }
    ) =>
      ipcRenderer.invoke('mediaTags:bulkApply', mediaIds, tagId, subject) as Promise<{
        applied: number
        skipped: number
      }>
  },
  tagGroups: {
    list: () => ipcRenderer.invoke('tagGroups:list') as Promise<TagGroup[]>,
    create: (label: string) => ipcRenderer.invoke('tagGroups:create', label) as Promise<TagGroup>,
    update: (id: number, patch: { label?: string; color?: string | null; icon?: string | null }) =>
      ipcRenderer.invoke('tagGroups:update', id, patch) as Promise<TagGroup>,
    move: (id: number, direction: 'up' | 'down') =>
      ipcRenderer.invoke('tagGroups:move', id, direction),
    remove: (id: number) => ipcRenderer.invoke('tagGroups:remove', id)
  },
  subjects: {
    list: (mediaId: number) => ipcRenderer.invoke('subjects:list', mediaId),
    ensure: (mediaId: number) => ipcRenderer.invoke('subjects:ensure', mediaId),
    add: (mediaId: number, label: string) => ipcRenderer.invoke('subjects:add', mediaId, label),
    remove: (subjectId: number) => ipcRenderer.invoke('subjects:remove', subjectId)
  },
  collections: {
    list: () => ipcRenderer.invoke('collections:list'),
    get: (id: number) => ipcRenderer.invoke('collections:get', id),
    create: (name: string, desc?: string) => ipcRenderer.invoke('collections:create', name, desc),
    update: (id: number, patch: { name?: string; description_md?: string }) =>
      ipcRenderer.invoke('collections:update', id, patch),
    delete: (id: number) => ipcRenderer.invoke('collections:delete', id),
    members: (id: number) => ipcRenderer.invoke('collections:members', id),
    media: (id: number) => ipcRenderer.invoke('collections:media', id),
    addMember: (colId: number, mediaId: number) =>
      ipcRenderer.invoke('collections:add-member', colId, mediaId),
    removeMember: (colId: number, mediaId: number) =>
      ipcRenderer.invoke('collections:remove-member', colId, mediaId),
    forMedia: (mediaId: number) => ipcRenderer.invoke('collections:for-media', mediaId),
    principalTags: (id: number) => ipcRenderer.invoke('collections:principal-tags', id),
    setPrincipalTags: (id: number, tagIds: number[]) =>
      ipcRenderer.invoke('collections:set-principal-tags', id, tagIds),
    addPrincipalTag: (id: number, tagId: number) =>
      ipcRenderer.invoke('collections:add-principal-tag', id, tagId) as Promise<Tag[]>,
    principalTagSuggestions: (id: number) =>
      ipcRenderer.invoke('collections:principal-tag-suggestions', id) as Promise<Tag[]>,
    search: (q: string) => ipcRenderer.invoke('collections:search', q),
    byPrincipalTag: (tagId: number) => ipcRenderer.invoke('collections:by-principal-tag', tagId),
    reorder: (orderedIds: number[]) => ipcRenderer.invoke('collections:reorder', orderedIds),
    move: (id: number, direction: 'up' | 'down') =>
      ipcRenderer.invoke('collections:move', id, direction),
    externalLinks: (id: number) =>
      ipcRenderer.invoke('collections:external-links', id) as Promise<CollectionExternalLink[]>,
    addExternalLink: (collectionId: number, label: string, url: string) =>
      ipcRenderer.invoke('collections:add-external-link', collectionId, label, url),
    updateExternalLink: (id: number, label: string, url: string) =>
      ipcRenderer.invoke('collections:update-external-link', id, label, url),
    removeExternalLink: (id: number) => ipcRenderer.invoke('collections:remove-external-link', id)
  },
  crop: {
    get: (mediaId: number) => ipcRenderer.invoke('crop:get', mediaId),
    set: (mediaId: number, rect: CropRect) => ipcRenderer.invoke('crop:set', mediaId, rect),
    clear: (mediaId: number) => ipcRenderer.invoke('crop:clear', mediaId),
    export: (mediaId: number) => ipcRenderer.invoke('crop:export', mediaId)
  },
  wiki: {
    get: (entityType: 'tag' | 'media' | 'collection', entityId: number) =>
      ipcRenderer.invoke('wiki:get', entityType, entityId),
    save: (entityType: 'tag' | 'media' | 'collection', entityId: number, body: string) =>
      ipcRenderer.invoke('wiki:save', entityType, entityId, body)
  },
  identifiers: {
    list: () => ipcRenderer.invoke('identifiers:list') as Promise<Identifier[]>,
    create: (input: { label: string; icon: string; color: string; query_text: string }) =>
      ipcRenderer.invoke('identifiers:create', input) as Promise<Identifier>,
    update: (id: number, input: { label: string; icon: string; color: string; query_text: string }) =>
      ipcRenderer.invoke('identifiers:update', id, input) as Promise<Identifier>,
    delete: (id: number) => ipcRenderer.invoke('identifiers:delete', id),
    setEnabled: (id: number, enabled: boolean) =>
      ipcRenderer.invoke('identifiers:setEnabled', id, enabled) as Promise<Identifier>,
    move: (id: number, direction: 'up' | 'down') =>
      ipcRenderer.invoke('identifiers:move', id, direction),
    validateQuery: (query_text: string) =>
      ipcRenderer.invoke('identifiers:validateQuery', query_text) as Promise<
        { astJson: string } | { error: string }
      >,
    badgesForMediaIds: (mediaIds: number[]) =>
      ipcRenderer.invoke('identifiers:badgesForMediaIds', mediaIds) as Promise<
        Record<number, IdentifierBadge[]>
      >
  },
  search: {
    savedList: () => ipcRenderer.invoke('search:saved-list'),
    savedCreate: (name: string, queryJson: string) =>
      ipcRenderer.invoke('search:saved-create', name, queryJson),
    savedDelete: (id: number) => ipcRenderer.invoke('search:saved-delete', id),
    savedUpdate: (id: number, patch: { name?: string; query_json?: string }) =>
      ipcRenderer.invoke('search:saved-update', id, patch)
  },
  fs: {
    rename: (mediaId: number, newName: string) => ipcRenderer.invoke('fs:rename', mediaId, newName),
    delete: (mediaId: number) => ipcRenderer.invoke('fs:delete', mediaId),
    reveal: (mediaId: number) => ipcRenderer.invoke('fs:reveal', mediaId)
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url)
  },
  boards: {
    getRoot: () => ipcRenderer.invoke('boards:get-root') as Promise<string | null>,
    setRoot: (path: string | null) => ipcRenderer.invoke('boards:set-root', path),
    pickRoot: () => ipcRenderer.invoke('boards:pick-root') as Promise<string | null>,
    list: () => ipcRenderer.invoke('boards:list') as Promise<BoardSummary[]>,
    read: (fileName: string) => ipcRenderer.invoke('boards:read', fileName) as Promise<BoardDocument>,
    write: (fileName: string, doc: BoardDocument) =>
      ipcRenderer.invoke('boards:write', fileName, doc) as Promise<BoardDocument>,
    create: (name: string) =>
      ipcRenderer.invoke('boards:create', name) as Promise<{ fileName: string; document: BoardDocument }>,
    delete: (fileName: string) => ipcRenderer.invoke('boards:delete', fileName),
    rename: (fileName: string, name: string) =>
      ipcRenderer.invoke('boards:rename', fileName, name) as Promise<{
        fileName: string
        document: BoardDocument
      }>,
    exportPng: (fileName: string) =>
      ipcRenderer.invoke('boards:export-png', fileName) as Promise<string | null>
  },
  updater: {
    getState: () => ipcRenderer.invoke('updater:get-state') as Promise<UpdaterStatus>,
    check: () => ipcRenderer.invoke('updater:check') as Promise<UpdaterStatus>,
    download: () => ipcRenderer.invoke('updater:download') as Promise<UpdaterStatus>,
    quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install') as Promise<void>,
    openReleases: () => ipcRenderer.invoke('updater:open-releases') as Promise<void>,
    onStatus: (callback: (status: UpdaterStatus) => void) => {
      const listener = (_e: unknown, status: UpdaterStatus) => callback(status)
      ipcRenderer.on('updater:status', listener)
      return () => {
        ipcRenderer.removeListener('updater:status', listener)
      }
    }
  },
  db: {
    getPath: () => ipcRenderer.invoke('db:get-path') as Promise<string>,
    getDataDir: () => ipcRenderer.invoke('db:get-data-dir') as Promise<string>,
    openDataFolder: () => ipcRenderer.invoke('db:open-data-folder') as Promise<void>,
    backup: () => ipcRenderer.invoke('db:backup') as Promise<string | null>
  }
}

contextBridge.exposeInMainWorld('collectionXiewer', api)

export type CollectionXiewerApi = typeof api
