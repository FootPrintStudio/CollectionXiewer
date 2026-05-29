import { getDb } from '../db/database'

const BOARDS_ROOT_KEY = 'boards_root_path'
const TAG_GRAPH_EPOCH = 'tag_graph_epoch'
const TAG_CLOSURE_EPOCH = 'tag_closure_epoch'
const FTS_DIRTY = 'fts_dirty'

export function getPref(key: string): string | null {
  const row = getDb().prepare(`SELECT value FROM app_prefs WHERE key = ?`).get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function setPref(key: string, value: string | null): void {
  const db = getDb()
  if (value == null) {
    db.prepare(`DELETE FROM app_prefs WHERE key = ?`).run(key)
    return
  }
  db.prepare(
    `INSERT INTO app_prefs (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value)
}

export function getBoardsRootPath(): string | null {
  return getPref(BOARDS_ROOT_KEY)
}

export function setBoardsRootPath(path: string | null): void {
  setPref(BOARDS_ROOT_KEY, path)
}

export function bumpTagGraphEpoch(): void {
  const current = Number(getPref(TAG_GRAPH_EPOCH) ?? '0')
  setPref(TAG_GRAPH_EPOCH, String(current + 1))
}

export function markFtsDirty(): void {
  setPref(FTS_DIRTY, '1')
}

export function ensureTagClosureCurrent(rebuild: () => void): void {
  const graphEpoch = getPref(TAG_GRAPH_EPOCH) ?? '0'
  const closureEpoch = getPref(TAG_CLOSURE_EPOCH) ?? ''
  if (graphEpoch !== closureEpoch) {
    rebuild()
    setPref(TAG_CLOSURE_EPOCH, graphEpoch)
  }
}

export function syncTagClosureEpoch(): void {
  const graphEpoch = getPref(TAG_GRAPH_EPOCH) ?? '0'
  setPref(TAG_CLOSURE_EPOCH, graphEpoch)
}

export function ensureFtsCurrent(rebuild: () => void): void {
  const db = getDb()
  const dirty = getPref(FTS_DIRTY) === '1'
  const tagCount = (db.prepare(`SELECT COUNT(*) AS c FROM tags`).get() as { c: number }).c
  const ftsCount = (db.prepare(`SELECT COUNT(*) AS c FROM tags_fts`).get() as { c: number }).c
  const needsRebuild = dirty || (tagCount > 0 && ftsCount === 0)
  if (needsRebuild) {
    rebuild()
    setPref(FTS_DIRTY, '0')
  }
}
