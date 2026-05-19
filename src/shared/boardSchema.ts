export const BOARD_SCHEMA_VERSION = 1
export const BOARD_FILE_EXT = '.cxboard.json'

export interface BoardCamera {
  x: number
  y: number
  scale: number
}

export interface BoardGroup {
  id: string
  label: string
  locked: boolean
}

export interface BoardItemBase {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  locked: boolean
  groupId?: string | null
}

export interface BoardMediaItem extends BoardItemBase {
  kind: 'media'
  mediaId: number
  flipX: boolean
  flipY: boolean
  opacity: number
  /** Cached width/height ratio for aspect-locked transforms */
  aspectRatio?: number
}

export interface BoardNoteItem extends BoardItemBase {
  kind: 'note'
  text: string
  fontSize: number
  color: string
}

export type BoardItem = BoardMediaItem | BoardNoteItem

export interface BoardDocument {
  version: number
  name: string
  updatedAt: string
  camera: BoardCamera
  background: string
  groups: BoardGroup[]
  items: BoardItem[]
}

export interface BoardSummary {
  fileName: string
  name: string
  updatedAt: string
}

export function createEmptyBoard(name: string): BoardDocument {
  const now = new Date().toISOString()
  return {
    version: BOARD_SCHEMA_VERSION,
    name,
    updatedAt: now,
    camera: { x: 0, y: 0, scale: 1 },
    background: '#1a1a1a',
    groups: [],
    items: []
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function parseItemBase(raw: Record<string, unknown>): BoardItemBase | null {
  const id = str(raw.id)
  if (!id) return null
  return {
    id,
    x: num(raw.x),
    y: num(raw.y),
    width: Math.max(1, num(raw.width, 100)),
    height: Math.max(1, num(raw.height, 100)),
    rotation: num(raw.rotation),
    zIndex: num(raw.zIndex),
    locked: bool(raw.locked),
    groupId: raw.groupId == null ? null : str(raw.groupId) || null
  }
}

function parseItem(raw: unknown): BoardItem | null {
  if (!isRecord(raw)) return null
  const base = parseItemBase(raw)
  if (!base) return null
  const kind = raw.kind
  if (kind === 'media') {
    const mediaId = num(raw.mediaId)
    if (!mediaId) return null
    const aspectRaw = raw.aspectRatio
    const aspectRatio =
      typeof aspectRaw === 'number' && Number.isFinite(aspectRaw) && aspectRaw > 0
        ? aspectRaw
        : undefined
    return {
      ...base,
      kind: 'media',
      mediaId,
      flipX: bool(raw.flipX),
      flipY: bool(raw.flipY),
      opacity: Math.min(1, Math.max(0, num(raw.opacity, 1))),
      aspectRatio
    }
  }
  if (kind === 'note') {
    return {
      ...base,
      kind: 'note',
      text: str(raw.text),
      fontSize: Math.max(8, num(raw.fontSize, 14)),
      color: str(raw.color, '#e8e8e8')
    }
  }
  return null
}

export function parseBoardDocument(raw: unknown): BoardDocument {
  if (!isRecord(raw)) throw new Error('Invalid board file')
  const version = num(raw.version)
  if (version !== BOARD_SCHEMA_VERSION) {
    throw new Error(`Unsupported board version: ${version}`)
  }
  const itemsRaw = Array.isArray(raw.items) ? raw.items : []
  const items: BoardItem[] = []
  for (const item of itemsRaw) {
    const parsed = parseItem(item)
    if (parsed) items.push(parsed)
  }
  const groupsRaw = Array.isArray(raw.groups) ? raw.groups : []
  const groups: BoardGroup[] = []
  for (const g of groupsRaw) {
    if (!isRecord(g)) continue
    const id = str(g.id)
    if (!id) continue
    groups.push({
      id,
      label: str(g.label, 'Group'),
      locked: bool(g.locked)
    })
  }
  const cam = isRecord(raw.camera) ? raw.camera : {}
  return {
    version: BOARD_SCHEMA_VERSION,
    name: str(raw.name, 'Untitled board'),
    updatedAt: str(raw.updatedAt, new Date().toISOString()),
    camera: {
      x: num(cam.x),
      y: num(cam.y),
      scale: Math.min(8, Math.max(0.05, num(cam.scale, 1)))
    },
    background: str(raw.background, '#1a1a1a'),
    groups,
    items
  }
}

export function sanitizeFileName(name: string): string {
  const base = name
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return base || 'board'
}

export function boardFileNameFromName(name: string, id?: string): string {
  const slug = sanitizeFileName(name)
  const suffix = id ?? crypto.randomUUID().slice(0, 8)
  return `${slug}-${suffix}${BOARD_FILE_EXT}`
}
