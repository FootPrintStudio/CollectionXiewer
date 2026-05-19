import type { MediaItem } from '../../shared/types'

export function basenameFromRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1] ?? relativePath
}

export function dirnameFromRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  parts.pop()
  const dir = parts.join('/')
  return dir || '.'
}

export function splitFilename(filename: string): { stem: string; ext: string } {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot <= 0) return { stem: filename, ext: '' }
  return { stem: filename.slice(0, lastDot), ext: filename.slice(lastDot) }
}

export function formatMediaKind(kind: MediaItem['kind']): string {
  switch (kind) {
    case 'image':
      return 'Image'
    case 'video':
      return 'Video'
    case 'motion':
      return 'Motion'
    default:
      return 'Unknown'
  }
}

export function formatDimensions(width: number | null, height: number | null): string {
  if (width && height) return `${width} × ${height}`
  if (width) return `${width} px wide`
  if (height) return `${height} px tall`
  return '—'
}

export function formatTimestamp(ms: number | string): string {
  const date = typeof ms === 'number' ? new Date(ms) : new Date(ms)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}
