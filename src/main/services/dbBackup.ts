import { copyFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { shell } from 'electron'
import { getDb, getDbPath } from '../db/database'

export function getDataDir(): string {
  return dirname(getDbPath())
}

/** Consistent backup under WAL (async online backup with sync fallback). */
export async function backupDatabase(destPath: string): Promise<void> {
  const db = getDb()
  try {
    await db.backup(destPath)
  } catch {
    db.pragma('wal_checkpoint(TRUNCATE)')
    copyFileSync(getDbPath(), destPath)
  }
}

export function openDataFolder(): void {
  void shell.openPath(getDataDir())
}
