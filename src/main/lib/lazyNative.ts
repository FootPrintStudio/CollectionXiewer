import type Database from 'better-sqlite3'
import type Sharp from 'sharp'

type SqliteConstructor = typeof Database
type SharpModule = typeof Sharp

let sqliteCtor: SqliteConstructor | null = null

/** Load better-sqlite3 after Electron has started (avoids SIGBUS when bundled). */
export function getBetterSqlite3(): SqliteConstructor {
  if (!sqliteCtor) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sqliteCtor = require('better-sqlite3') as SqliteConstructor
  }
  return sqliteCtor
}

let sharpModule: SharpModule | null = null

/** Load sharp after Electron has started (avoids SIGBUS when bundled). */
export function getSharp(): SharpModule {
  if (!sharpModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('sharp') as SharpModule | { default: SharpModule }
    sharpModule = typeof mod === 'function' ? mod : mod.default
  }
  return sharpModule
}
