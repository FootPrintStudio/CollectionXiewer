import { resolve, sep } from 'node:path'
import { getDb } from '../db/database'
import { getDataDir } from '../services/dbBackup'

/** True when candidate is root or a file/dir under root (after resolve). */
export function isPathInsideRoot(root: string, candidate: string): boolean {
  const rootResolved = resolve(root)
  const candidateResolved = resolve(candidate)
  if (candidateResolved === rootResolved) return true
  const prefix = rootResolved.endsWith(sep) ? rootResolved : rootResolved + sep
  return candidateResolved.startsWith(prefix)
}

function postersDir(): string {
  return resolve(getDataDir(), 'posters')
}

/** Paths the renderer may load via the cx-media protocol. */
export function isAllowedMediaProtocolPath(filePath: string): boolean {
  const resolved = resolve(filePath)

  try {
    const roots = getDb().prepare(`SELECT path FROM watch_roots`).all() as { path: string }[]
    for (const { path: rootPath } of roots) {
      if (rootPath && isPathInsideRoot(rootPath, resolved)) return true
    }
  } catch {
    return false
  }

  if (isPathInsideRoot(postersDir(), resolved)) return true
  if (isPathInsideRoot(getDataDir(), resolved)) return true

  return false
}
