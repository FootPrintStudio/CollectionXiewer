import { copyFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { shell } from 'electron'
import { getDbPath } from '../db/database'

export function getDataDir(): string {
  return dirname(getDbPath())
}

export function backupDatabase(destPath: string): void {
  copyFileSync(getDbPath(), destPath)
}

export function openDataFolder(): void {
  void shell.openPath(getDataDir())
}
