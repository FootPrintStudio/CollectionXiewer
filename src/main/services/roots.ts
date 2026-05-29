import { getDb } from '../db/database'
import type { WatchRoot } from '../../shared/types'
import { scanRoot, startWatching, stopWatching } from './watcher'
import { canonicalWatchRootPath } from './rootPaths'

export class DuplicateWatchRootError extends Error {
  constructor(path: string) {
    super(`This folder is already watched: ${path}`)
    this.name = 'DuplicateWatchRootError'
  }
}

function persistCanonicalPath(id: number, path: string): WatchRoot {
  const db = getDb()
  const canonical = canonicalWatchRootPath(path)
  if (canonical !== path) {
    try {
      db.prepare(`UPDATE watch_roots SET path = ? WHERE id = ?`).run(canonical, id)
    } catch {
      // UNIQUE(path) — another row already uses the resolved path; keep stored path
    }
  }
  const row = db.prepare(`SELECT * FROM watch_roots WHERE id = ?`).get(id) as WatchRoot
  return row
}

export function listRoots(): WatchRoot[] {
  const db = getDb()
  const rows = db.prepare(`SELECT * FROM watch_roots ORDER BY path`).all() as WatchRoot[]
  return rows.map((row) => persistCanonicalPath(row.id, row.path))
}

export function addRoot(path: string): WatchRoot {
  const canonical = canonicalWatchRootPath(path)
  const existing = getDb()
    .prepare(`SELECT id FROM watch_roots WHERE path = ?`)
    .get(canonical) as { id: number } | undefined
  if (existing) throw new DuplicateWatchRootError(canonical)
  const r = getDb()
    .prepare(`INSERT INTO watch_roots (path, enabled, last_scan_at) VALUES (?, 1, NULL)`)
    .run(canonical)
  const root = getDb().prepare(`SELECT * FROM watch_roots WHERE id = ?`).get(r.lastInsertRowid) as WatchRoot
  void scanRoot(root).then(() => startWatching(root))
  return root
}

export function removeRoot(id: number): void {
  stopWatching(id)
  getDb().prepare(`DELETE FROM watch_roots WHERE id = ?`).run(id)
}

export function rescanRoot(id: number): Promise<number> {
  const root = getDb().prepare(`SELECT * FROM watch_roots WHERE id = ?`).get(id) as WatchRoot
  return scanRoot(root)
}

export function initWatchers(): void {
  for (const root of listRoots()) {
    if (root.enabled) startWatching(root)
  }
}
