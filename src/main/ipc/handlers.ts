import { dialog, ipcMain, shell } from 'electron'
import type { BrowserWindow } from 'electron'
import { parseSearchAst } from '../../shared/searchAst'
import type { CropRect, MediaListQuery } from '../../shared/types'
import * as roots from '../services/roots'
import * as mediaQuery from '../services/mediaQuery'
import * as tags from '../services/tags'
import * as tagGroups from '../services/tagGroups'
import * as collections from '../services/collections'
import * as wiki from '../services/wiki'
import * as crop from '../services/crop'
import * as thumbs from '../services/thumbs'
import * as videoPoster from '../services/videoPoster'
import * as identifiers from '../services/identifiers'
import * as identifierMatch from '../services/identifierMatch'
import * as fsOps from '../services/fsOps'
import { getDb } from '../db/database'
import { exportCropped } from '../services/crop'
import { indexFile } from '../services/indexer'

let mainWindow: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindow = win
}

export function registerIpcHandlers(): void {
  ipcMain.handle('roots:list', () => roots.listRoots())
  ipcMain.handle('roots:add', async (_e, path: string) => roots.addRoot(path))
  ipcMain.handle('roots:remove', (_e, id: number) => roots.removeRoot(id))
  ipcMain.handle('roots:rescan', (_e, id: number) => roots.rescanRoot(id))
  ipcMain.handle('roots:pick-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('media:list', (_e, query: MediaListQuery) => mediaQuery.listMedia(query))
  ipcMain.handle('media:get', (_e, id: number) => mediaQuery.getMedia(id))
  ipcMain.handle(
    'media:search',
    (
      _e,
      astJson: string,
      limit?: number,
      offset?: number,
      sortOrder?: MediaListQuery['sortOrder']
    ) => mediaQuery.runSearchAst(parseSearchAst(astJson), limit, offset, { sortOrder })
  )

  ipcMain.handle('thumb:get', async (_e, mediaId: number, size: number) => {
    const media = mediaQuery.getMedia(mediaId)
    if (!media) return null
    const buf = await thumbs.generateThumbnail(media.absolute_path, size, mediaId)
    return buf.toString('base64')
  })

  ipcMain.handle('preview:get', async (_e, mediaId: number, maxDim: number) => {
    const media = mediaQuery.getMedia(mediaId)
    if (!media) return null
    const buf = await thumbs.generatePreviewBuffer(media.absolute_path, maxDim, mediaId)
    return buf.toString('base64')
  })

  ipcMain.handle('video:setPoster', (_e, mediaId: number, data: Buffer, timeMs: number) => {
    videoPoster.setPoster(mediaId, data, timeMs)
  })
  ipcMain.handle('video:clearPoster', (_e, mediaId: number) => {
    videoPoster.clearPoster(mediaId)
  })
  ipcMain.handle('video:getPosterPath', (_e, mediaId: number) => {
    if (!videoPoster.hasPoster(mediaId)) return null
    return videoPoster.posterFilePath(mediaId)
  })
  ipcMain.handle('video:getPosterTimeMs', (_e, mediaId: number) =>
    videoPoster.getPosterTimeMs(mediaId)
  )

  ipcMain.handle('tags:list', () => tags.listTags())
  ipcMain.handle('tags:get', (_e, id: number) => tags.getTag(id))
  ipcMain.handle('tags:create', (_e, input: Parameters<typeof tags.createTag>[0]) => tags.createTag(input))
  ipcMain.handle('tags:update', (_e, id: number, patch: Parameters<typeof tags.updateTag>[1]) =>
    tags.updateTag(id, patch)
  )
  ipcMain.handle('tags:set-parent', (_e, tagId: number, parentId: number | null) =>
    tags.setTagParent(tagId, parentId)
  )
  ipcMain.handle('tags:assign-group', (_e, tagId: number, tagGroupId: number | null) =>
    tags.assignTagToGroup(tagId, tagGroupId)
  )
  ipcMain.handle('tags:move', (_e, id: number, direction: 'up' | 'down') => {
    tags.moveTag(id, direction)
  })
  ipcMain.handle('tags:sort-children-alphabetically', (_e, parentTagId: number) => {
    tags.sortTagChildrenAlphabetically(parentTagId)
  })
  ipcMain.handle('tags:sort-group-roots-alphabetically', (_e, tagGroupId: number | null) => {
    tags.sortTagGroupRootsAlphabetically(tagGroupId)
  })

  ipcMain.handle('tagGroups:list', () => tagGroups.listTagGroups())
  ipcMain.handle('tagGroups:create', (_e, label: string) => tagGroups.createTagGroup(label))
  ipcMain.handle(
    'tagGroups:update',
    (_e, id: number, patch: { label?: string; color?: string | null; icon?: string | null }) =>
      tagGroups.updateTagGroup(id, patch)
  )
  ipcMain.handle('tagGroups:move', (_e, id: number, direction: 'up' | 'down') => {
    tagGroups.moveTagGroup(id, direction)
  })
  ipcMain.handle('tagGroups:remove', (_e, id: number) => tagGroups.removeTagGroup(id))
  ipcMain.handle('tags:search', (_e, q: string) => tags.searchTagsFts(q))
  ipcMain.handle('tags:connections', (_e, id: number) => tags.getConnections(id))
  ipcMain.handle('tags:add-connection', (_e, sourceId: number, targetId: number, kind: 'hard' | 'soft') =>
    tags.addConnection(sourceId, targetId, kind)
  )
  ipcMain.handle('tags:remove-connection', (_e, id: number) => tags.removeConnection(id))
  ipcMain.handle('tags:external-links', (_e, id: number) => tags.listExternalLinks(id))
  ipcMain.handle('tags:add-external-link', (_e, tagId: number, label: string, url: string) =>
    tags.addExternalLink(tagId, label, url)
  )
  ipcMain.handle('tags:update-external-link', (_e, id: number, label: string, url: string) =>
    tags.updateExternalLink(id, label, url)
  )
  ipcMain.handle('tags:remove-external-link', (_e, id: number) => tags.removeExternalLink(id))

  ipcMain.handle('mediaTags:list', (_e, mediaId: number) => tags.listMediaTags(mediaId))
  ipcMain.handle('mediaTags:listForMediaIds', (_e, mediaIds: number[]) =>
    tags.listMediaTagsForMediaIds(mediaIds)
  )
  ipcMain.handle('mediaTags:suggestions', (_e, mediaId: number) =>
    tags.listMediaTagSuggestions(mediaId)
  )
  ipcMain.handle('mediaTags:apply', (_e, mediaId: number, tagId: number, subjectId: number | null) =>
    tags.applyTag(mediaId, tagId, subjectId)
  )
  ipcMain.handle('mediaTags:remove', (_e, mediaId: number, tagId: number, subjectId: number | null) =>
    tags.removeMediaTag(mediaId, tagId, subjectId)
  )
  ipcMain.handle(
    'mediaTags:move',
    (_e, mediaId: number, tagId: number, fromSubjectId: number, toSubjectId: number) => {
      tags.moveMediaTag(mediaId, tagId, fromSubjectId, toSubjectId)
    }
  )
  ipcMain.handle(
    'mediaTags:bulkApply',
    (
      _e,
      mediaIds: number[],
      tagId: number,
      subject: tags.BulkApplySubject
    ) => tags.bulkApplyTag(mediaIds, tagId, subject)
  )

  ipcMain.handle('subjects:list', (_e, mediaId: number) => tags.listSubjects(mediaId))
  ipcMain.handle('subjects:ensure', (_e, mediaId: number) => tags.ensureUniversalSubject(mediaId))
  ipcMain.handle('subjects:add', (_e, mediaId: number, label: string) => tags.addSubject(mediaId, label))
  ipcMain.handle('subjects:remove', (_e, subjectId: number) => tags.removeSubject(subjectId))

  ipcMain.handle('identifiers:list', () => identifiers.listIdentifiers())
  ipcMain.handle('identifiers:create', (_e, input: identifiers.IdentifierInput) =>
    identifiers.createIdentifier(input)
  )
  ipcMain.handle('identifiers:update', (_e, id: number, input: identifiers.IdentifierInput) =>
    identifiers.updateIdentifier(id, input)
  )
  ipcMain.handle('identifiers:delete', (_e, id: number) => identifiers.deleteIdentifier(id))
  ipcMain.handle('identifiers:setEnabled', (_e, id: number, enabled: boolean) =>
    identifiers.setIdentifierEnabled(id, enabled)
  )
  ipcMain.handle('identifiers:move', (_e, id: number, direction: 'up' | 'down') => {
    identifiers.moveIdentifier(id, direction)
  })
  ipcMain.handle('identifiers:validateQuery', (_e, query_text: string) =>
    identifiers.validateIdentifierQuery(query_text)
  )
  ipcMain.handle('identifiers:badgesForMediaIds', (_e, mediaIds: number[]) =>
    identifierMatch.identifierBadgesForMediaIds(mediaIds)
  )

  ipcMain.handle('collections:list', () => collections.listCollections())
  ipcMain.handle('collections:get', (_e, id: number) => collections.getCollection(id))
  ipcMain.handle('collections:create', (_e, name: string, desc?: string) =>
    collections.createCollection(name, desc)
  )
  ipcMain.handle('collections:update', (_e, id: number, patch: { name?: string; description_md?: string }) =>
    collections.updateCollection(id, patch)
  )
  ipcMain.handle('collections:delete', (_e, id: number) => collections.deleteCollection(id))
  ipcMain.handle('collections:members', (_e, id: number) => collections.listCollectionMembers(id))
  ipcMain.handle('collections:media', (_e, id: number) => collections.listCollectionMedia(id))
  ipcMain.handle('collections:add-member', (_e, colId: number, mediaId: number) =>
    collections.addToCollection(colId, mediaId)
  )
  ipcMain.handle('collections:remove-member', (_e, colId: number, mediaId: number) =>
    collections.removeFromCollection(colId, mediaId)
  )
  ipcMain.handle('collections:for-media', (_e, mediaId: number) =>
    collections.listCollectionsForMedia(mediaId)
  )
  ipcMain.handle('collections:principal-tags', (_e, id: number) => collections.getPrincipalTags(id))
  ipcMain.handle('collections:set-principal-tags', (_e, id: number, tagIds: number[]) =>
    collections.setPrincipalTags(id, tagIds)
  )
  ipcMain.handle('collections:search', (_e, q: string) => collections.searchCollectionsFts(q))
  ipcMain.handle('collections:by-principal-tag', (_e, tagId: number) =>
    collections.searchCollectionsByPrincipalTag(tagId)
  )

  ipcMain.handle('crop:get', (_e, mediaId: number) => crop.getCrop(mediaId))
  ipcMain.handle('crop:set', (_e, mediaId: number, rect: CropRect) => crop.setCrop(mediaId, rect))
  ipcMain.handle('crop:clear', (_e, mediaId: number) => crop.clearCrop(mediaId))
  ipcMain.handle('crop:export', async (_e, mediaId: number) => {
    const media = mediaQuery.getMedia(mediaId)
    if (!media) throw new Error('No media')
    const c = crop.getCrop(mediaId)
    if (!c) throw new Error('No crop')
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: media.relative_path,
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'webp'] }]
    })
    if (result.canceled || !result.filePath) return null
    await exportCropped(media.absolute_path, c, result.filePath)
    const root = getDb().prepare(`SELECT * FROM watch_roots WHERE id = ?`).get(media.root_id) as {
      id: number
      path: string
    }
    const item = await indexFile(root.id, root.path, result.filePath)
    return item
  })

  ipcMain.handle('wiki:get', (_e, entityType: 'tag' | 'media' | 'collection', entityId: number) =>
    wiki.getWiki(entityType, entityId)
  )
  ipcMain.handle('wiki:save', (_e, entityType: 'tag' | 'media' | 'collection', entityId: number, body: string) =>
    wiki.saveWiki(entityType, entityId, body)
  )

  ipcMain.handle('search:saved-list', () =>
    getDb().prepare(`SELECT * FROM saved_searches ORDER BY name`).all()
  )
  ipcMain.handle('search:saved-create', (_e, name: string, queryJson: string) => {
    const r = getDb()
      .prepare(`INSERT INTO saved_searches (name, query_json) VALUES (?, ?)`)
      .run(name, queryJson)
    return getDb().prepare(`SELECT * FROM saved_searches WHERE id = ?`).get(r.lastInsertRowid)
  })
  ipcMain.handle('search:saved-delete', (_e, id: number) => {
    getDb().prepare(`DELETE FROM saved_searches WHERE id = ?`).run(id)
  })

  ipcMain.handle('fs:rename', (_e, mediaId: number, newName: string) => fsOps.renameMedia(mediaId, newName))
  ipcMain.handle('fs:delete', (_e, mediaId: number) => fsOps.deleteMediaFile(mediaId))
  ipcMain.handle('fs:reveal', (_e, mediaId: number) => fsOps.revealMedia(mediaId))

  ipcMain.handle('shell:open-external', (_e, url: string) => shell.openExternal(url))
}
