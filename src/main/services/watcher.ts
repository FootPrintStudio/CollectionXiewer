import chokidar, { type FSWatcher } from 'chokidar'
import { join } from 'node:path'
import { getDb } from '../db/database'
import { classifyFile, indexFile, markMissing, shouldSkipDir } from './indexer'
import { enqueueIndexJob } from './indexQueue'
import { isWatcherPathSuppressed } from './watcherSuppress'
import type { WatchRoot } from '../../shared/types'

const watchers = new Map<number, FSWatcher>()

function logWatcherError(rootId: number, context: string, err: unknown): void {
  console.warn(
    `[watcher] root ${rootId} ${context}:`,
    err instanceof Error ? err.message : err
  )
}

function runWatcherJob(rootId: number, context: string, job: () => Promise<void>): void {
  void enqueueIndexJob(job).catch((err) => logWatcherError(rootId, context, err))
}

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
    const files: string[] = []
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue
      const full = join(dir, ent.name)
      if (ent.isDirectory()) {
        if (shouldSkipDir(ent.name)) continue
        await walk(full)
      } else if (ent.isFile()) {
        files.push(full)
      }
    }
    await Promise.all(
      files.map((full) =>
        enqueueIndexJob(async () => {
          const { kind } = classifyFile(full)
          if (kind === 'unknown') return
          const item = await indexFile(root.id, root.path, full)
          if (item) count++
        })
      )
    )
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

  watcher.on('add', (filePath) => {
    try {
      if (isWatcherPathSuppressed(filePath)) return
      runWatcherJob(root.id, 'add', async () => {
        if (isWatcherPathSuppressed(filePath)) return
        const { kind } = classifyFile(filePath)
        if (kind !== 'unknown') await indexFile(root.id, root.path, filePath)
      })
    } catch (err) {
      logWatcherError(root.id, 'add', err)
    }
  })

  watcher.on('change', (filePath) => {
    try {
      if (isWatcherPathSuppressed(filePath)) return
      runWatcherJob(root.id, 'change', async () => {
        if (isWatcherPathSuppressed(filePath)) return
        const { kind } = classifyFile(filePath)
        if (kind !== 'unknown') await indexFile(root.id, root.path, filePath)
      })
    } catch (err) {
      logWatcherError(root.id, 'change', err)
    }
  })

  watcher.on('unlink', (filePath) => {
    try {
      if (isWatcherPathSuppressed(filePath)) return
      const rel = filePath.replace(root.path, '').replace(/^[/\\]/, '')
      markMissing(root.id, rel)
    } catch (err) {
      logWatcherError(root.id, 'unlink', err)
    }
  })

  watcher.on('error', (err) => {
    logWatcherError(root.id, 'error', err)
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

export async function stopAllWatchersAsync(): Promise<void> {
  const closers: Promise<void>[] = []
  for (const [id, w] of watchers) {
    watchers.delete(id)
    closers.push(Promise.resolve(w.close()).then(() => undefined))
  }
  await Promise.all(closers)
}
