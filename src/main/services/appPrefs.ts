import { getDb } from '../db/database'

const BOARDS_ROOT_KEY = 'boards_root_path'

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
