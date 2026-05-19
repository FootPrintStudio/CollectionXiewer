import { access, rename, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { shell } from 'electron'
import { relative } from 'node:path'
import { getDb } from '../db/database'
import { getMedia } from './mediaQuery'
import { removeMediaWikiFts } from './wikiFts'

function sanitizeBaseName(name: string): string {
  const trimmed = name.trim().replace(/[/\\<>:"|?*\x00-\x1f]/g, '')
  if (!trimmed) throw new Error('File name cannot be empty.')
  if (trimmed === '.' || trimmed === '..') throw new Error('Invalid file name.')
  return trimmed
}

export async function renameMedia(mediaId: number, newBaseName: string): Promise<string> {
  const media = getMedia(mediaId)
  if (!media) throw new Error('Media not found')
  const root = getDb().prepare(`SELECT path FROM watch_roots WHERE id = ?`).get(media.root_id) as {
    path: string
  }
  const dir = dirname(media.absolute_path)
  const ext = media.absolute_path.includes('.')
    ? media.absolute_path.slice(media.absolute_path.lastIndexOf('.'))
    : ''
  const safeBase = sanitizeBaseName(newBaseName)
  const newName = safeBase.includes('.') ? safeBase : `${safeBase}${ext}`
  const newPath = join(dir, newName)
  if (newPath === media.absolute_path) return newPath

  try {
    await access(newPath)
    throw new Error('A file with that name already exists in this folder.')
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
    if (code !== 'ENOENT') throw err
  }

  await rename(media.absolute_path, newPath)
  const rel = relative(root.path, newPath)
  getDb()
    .prepare(`UPDATE media_items SET relative_path = ?, mtime = ? WHERE id = ?`)
    .run(rel, Date.now(), mediaId)
  return newPath
}

export async function deleteMediaFile(mediaId: number): Promise<void> {
  const media = getMedia(mediaId)
  if (!media) throw new Error('Media not found')
  await unlink(media.absolute_path)
  removeMediaWikiFts(mediaId)
  getDb().prepare(`DELETE FROM media_items WHERE id = ?`).run(mediaId)
}

export function revealMedia(mediaId: number): void {
  const media = getMedia(mediaId)
  if (media) shell.showItemInFolder(media.absolute_path)
}
