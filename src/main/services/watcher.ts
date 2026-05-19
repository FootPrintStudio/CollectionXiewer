import chokidar, { type FSWatcher } from 'chokidar'
import { join } from 'node:path'
import { getDb } from '../db/database'
import { classifyFile, indexFile, markMissing, removeMedia, shouldSkipDir } from './indexer'
import type { WatchRoot } from '../../shared/types'

const watchers = new Map<number, FSWatcher>()

export async function scanRoot(root: WatchRoot): Promise<number> {
  const db = getDb()
  let count = 0
  const { readdir } = await import('node:fs/promises')

  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue
      const full = join(dir, ent.name)
      if (ent.isDirectory()) {
        if (shouldSkipDir(ent.name)) continue
        await walk(full)
      } else if (ent.isFile()) {
        const { kind } = classifyFile(full)
        if (kind !== 'unknown') {
          const item = await indexFile(root.id, root.path, full)
          if (item) count++
        }
      }
    }
  }

  await walk(root.path)
  db.prepare(`UPDATE watch_roots SET last_scan_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    root.id
  )
  return count
}

export function startWatching(root: WatchRoot): void {
  stopWatching(root.id)
  if (!root.enabled) return

  const watcher = chokidar.watch(root.path, {
    ignored: (path) => {
      const parts = path.split(/[/\\]/)
      return parts.some((p) => shouldSkipDir(p))
    },
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 }
  })

  watcher.on('add', async (filePath) => {
    const { kind } = classifyFile(filePath)
    if (kind !== 'unknown') await indexFile(root.id, root.path, filePath)
  })

  watcher.on('change', async (filePath) => {
    const { kind } = classifyFile(filePath)
    if (kind !== 'unknown') await indexFile(root.id, root.path, filePath)
  })

  watcher.on('unlink', (filePath) => {
    const rel = filePath.replace(root.path, '').replace(/^[/\\]/, '')
    removeMedia(root.id, rel)
  })

  watchers.set(root.id, watcher)
}

export function stopWatching(rootId: number): void {
  const w = watchers.get(rootId)
  if (w) {
    void w.close()
    watchers.delete(rootId)
  }
}

export function stopAllWatchers(): void {
  for (const id of watchers.keys()) stopWatching(id)
}
