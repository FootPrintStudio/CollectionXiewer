import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'

/** Resolve to an absolute, symlink-expanded path for consistent nesting and storage. */
export function canonicalWatchRootPath(path: string): string {
  const resolved = resolve(path)
  try {
    return realpathSync.native(resolved)
  } catch {
    try {
      return realpathSync(resolved)
    } catch {
      return resolved
    }
  }
}
