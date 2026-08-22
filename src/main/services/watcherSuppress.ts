/** Paths currently being written by in-app operations (crop, etc.). */
const suppressed = new Map<string, number>()

export function suppressWatcherPath(absolutePath: string, ttlMs = 5000): void {
  suppressed.set(absolutePath, Date.now() + ttlMs)
}

export function isWatcherPathSuppressed(absolutePath: string): boolean {
  const until = suppressed.get(absolutePath)
  if (until == null) return false
  if (Date.now() > until) {
    suppressed.delete(absolutePath)
    return false
  }
  return true
}
