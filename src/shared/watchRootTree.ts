import type { WatchRoot } from './types'

/** Browser-safe POSIX path normalize (no Node `path` — used in renderer). */
function normalizePosixPath(path: string): string {
  const posix = path.replace(/\\/g, '/').trim()
  if (!posix) return ''
  const isAbsolute = posix.startsWith('/')
  const stack: string[] = []
  for (const part of posix.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (stack.length > 0) stack.pop()
      continue
    }
    stack.push(part)
  }
  const joined = stack.join('/')
  return isAbsolute ? `/${joined}` : joined || '.'
}

export interface WatchRootTreeNode {
  root: WatchRoot
  children: WatchRootTreeNode[]
}

/** Split a path into normalized segments (resolves `.` and `..`). */
export function splitWatchRootPath(path: string): string[] {
  let normalized = normalizePosixPath(path)
  if (!normalized) return []

  const isAbsolute = normalized.startsWith('/')
  let rest = normalized.replace(/\/+$/, '')
  if (isAbsolute) rest = rest.slice(1)

  const stack: string[] = []
  for (const part of rest.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (stack.length > 0) stack.pop()
      continue
    }
    stack.push(part)
  }
  return stack
}

export function normalizeWatchRootPath(path: string): string {
  const segments = splitWatchRootPath(path)
  if (segments.length === 0) return '/'
  return `/${segments.join('/')}`
}

export function watchRootFolderName(path: string): string {
  const segments = splitWatchRootPath(path)
  if (segments.length === 0) {
    const trimmed = path.replace(/\\/g, '/').replace(/\/+$/, '')
    if (trimmed === '/' || trimmed === '') return '/'
    const slash = trimmed.lastIndexOf('/')
    return slash >= 0 ? trimmed.slice(slash + 1) : trimmed
  }
  return segments[segments.length - 1]!
}

export function isWatchRootSubPath(parentPath: string, childPath: string): boolean {
  const parent = splitWatchRootPath(parentPath)
  const child = splitWatchRootPath(childPath)
  if (parent.length === 0 || child.length <= parent.length) return false
  for (let i = 0; i < parent.length; i++) {
    if (parent[i] !== child[i]) return false
  }
  return true
}

/** Nest watch roots when one path lies inside another on disk. */
export function buildWatchRootTree(roots: WatchRoot[]): WatchRootTreeNode[] {
  if (roots.length === 0) return []

  const sorted = [...roots].sort((a, b) => {
    const aLen = splitWatchRootPath(a.path).length
    const bLen = splitWatchRootPath(b.path).length
    return aLen - bLen || normalizeWatchRootPath(a.path).localeCompare(normalizeWatchRootPath(b.path))
  })

  const nodes = new Map<number, WatchRootTreeNode>()
  for (const root of sorted) {
    nodes.set(root.id, { root, children: [] })
  }

  const topLevel: WatchRootTreeNode[] = []

  for (const root of sorted) {
    const node = nodes.get(root.id)!
    let parentNode: WatchRootTreeNode | null = null
    let parentDepth = -1

    for (const candidate of sorted) {
      if (candidate.id === root.id) continue
      if (!isWatchRootSubPath(candidate.path, root.path)) continue
      const depth = splitWatchRootPath(candidate.path).length
      if (depth > parentDepth) {
        parentNode = nodes.get(candidate.id)!
        parentDepth = depth
      }
    }

    if (parentNode) parentNode.children.push(node)
    else topLevel.push(node)
  }

  const sortByName = (list: WatchRootTreeNode[]) => {
    list.sort((a, b) =>
      watchRootFolderName(a.root.path).localeCompare(watchRootFolderName(b.root.path), undefined, {
        sensitivity: 'base'
      })
    )
    for (const n of list) sortByName(n.children)
  }
  sortByName(topLevel)

  return topLevel
}
