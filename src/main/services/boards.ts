import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { dialog } from 'electron'
import type { BrowserWindow } from 'electron'
import {
  BOARD_FILE_EXT,
  BOARD_SCHEMA_VERSION,
  boardFileNameFromName,
  createEmptyBoard,
  parseBoardDocument,
  type BoardDocument,
  type BoardSummary
} from '../../shared/boardSchema'
import { getBoardsRootPath, setBoardsRootPath } from './appPrefs'
import * as mediaQuery from './mediaQuery'
import * as thumbs from './thumbs'
import { getSharp } from '../lib/lazyNative'

let mainWindow: BrowserWindow | null = null

export function setBoardsMainWindow(win: BrowserWindow | null): void {
  mainWindow = win
}

function requireRoot(): string {
  const root = getBoardsRootPath()
  if (!root) throw new Error('Boards folder not set')
  if (!existsSync(root)) throw new Error('Boards folder does not exist')
  return root
}

function boardPath(fileName: string): string {
  return join(requireRoot(), fileName)
}

export function pickBoardsRootFolder(): Promise<string | null> {
  return dialog
    .showOpenDialog(mainWindow!, { properties: ['openDirectory', 'createDirectory'] })
    .then((r) => (r.canceled ? null : r.filePaths[0] ?? null))
}

export function listBoards(): BoardSummary[] {
  const root = getBoardsRootPath()
  if (!root || !existsSync(root)) return []
  const files = readdirSync(root).filter((f) => f.endsWith(BOARD_FILE_EXT))
  const out: BoardSummary[] = []
  for (const fileName of files) {
    try {
      const raw = JSON.parse(readFileSync(join(root, fileName), 'utf8'))
      const doc = parseBoardDocument(raw)
      out.push({ fileName, name: doc.name, updatedAt: doc.updatedAt })
    } catch {
      out.push({
        fileName,
        name: fileName.replace(BOARD_FILE_EXT, ''),
        updatedAt: ''
      })
    }
  }
  out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return out
}

export function readBoard(fileName: string): BoardDocument {
  const raw = JSON.parse(readFileSync(boardPath(fileName), 'utf8'))
  return parseBoardDocument(raw)
}

export function writeBoard(fileName: string, doc: BoardDocument): BoardDocument {
  const root = requireRoot()
  mkdirSync(root, { recursive: true })
  const next: BoardDocument = {
    ...doc,
    version: BOARD_SCHEMA_VERSION,
    updatedAt: new Date().toISOString()
  }
  writeFileSync(boardPath(fileName), JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function createBoard(name: string): { fileName: string; document: BoardDocument } {
  const root = requireRoot()
  mkdirSync(root, { recursive: true })
  const fileName = boardFileNameFromName(name, randomUUID().slice(0, 8))
  const doc = createEmptyBoard(name.trim() || 'Untitled board')
  writeBoard(fileName, doc)
  return { fileName, document: doc }
}

export function deleteBoard(fileName: string): void {
  unlinkSync(boardPath(fileName))
}

export function renameBoard(fileName: string, newName: string): BoardDocument {
  const doc = readBoard(fileName)
  doc.name = newName.trim() || doc.name
  return writeBoard(fileName, doc)
}

export function renameBoardFile(fileName: string, newDisplayName: string): {
  fileName: string
  document: BoardDocument
} {
  const doc = renameBoard(fileName, newDisplayName)
  return { fileName, document: doc }
}

export interface ExportBoardOptions {
  padding?: number
  scale?: number
  maxDim?: number
}

export async function exportBoardPng(
  fileName: string,
  outputPath: string,
  opts: ExportBoardOptions = {}
): Promise<void> {
  const doc = readBoard(fileName)
  const padding = opts.padding ?? 32
  const scale = opts.scale ?? 1
  const maxDim = opts.maxDim ?? 2048

  const mediaItems = doc.items.filter((i) => i.kind === 'media')
  if (mediaItems.length === 0) throw new Error('Board has no media items')

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const item of doc.items) {
    minX = Math.min(minX, item.x)
    minY = Math.min(minY, item.y)
    maxX = Math.max(maxX, item.x + item.width)
    maxY = Math.max(maxY, item.y + item.height)
  }
  if (!Number.isFinite(minX)) {
    minX = 0
    minY = 0
    maxX = 800
    maxY = 600
  }

  const worldW = (maxX - minX + padding * 2) * scale
  const worldH = (maxY - minY + padding * 2) * scale
  const sharp = getSharp()
  const canvas = sharp({
    create: {
      width: Math.ceil(worldW),
      height: Math.ceil(worldH),
      channels: 4,
      background: doc.background || '#1a1a1a'
    }
  })

  const composites: { input: Buffer; left: number; top: number }[] = []
  const sorted = [...doc.items].sort((a, b) => a.zIndex - b.zIndex)

  for (const item of sorted) {
    if (item.kind !== 'media') continue
    const media = mediaQuery.getMedia(item.mediaId)
    if (!media) continue
    const buf = await thumbs.generatePreviewBuffer(media.absolute_path, maxDim, media.id, media.kind)
    if (!buf) continue

    let img = sharp(buf).resize(Math.round(item.width * scale), Math.round(item.height * scale), {
      fit: 'fill'
    })
    if (item.flipY) img = img.flip()
    if (item.flipX) img = img.flop()
    if (item.rotation) {
      img = img.rotate(item.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    }
    if (item.opacity < 1) {
      const meta = await img.metadata()
      const w = meta.width ?? Math.round(item.width * scale)
      const h = meta.height ?? Math.round(item.height * scale)
      const alpha = Math.round(item.opacity * 255)
      const alphaBuf = Buffer.alloc(w * h, alpha)
      img = img.joinChannel(alphaBuf, { raw: { width: w, height: h, channels: 1 } })
    }

    const rendered = await img.png().toBuffer()
    const meta = await sharp(rendered).metadata()
    const rw = meta.width ?? Math.round(item.width * scale)
    const rh = meta.height ?? Math.round(item.height * scale)
    const left = Math.round((item.x - minX + padding) * scale + (item.width * scale - rw) / 2)
    const top = Math.round((item.y - minY + padding) * scale + (item.height * scale - rh) / 2)
    composites.push({ input: rendered, left: Math.max(0, left), top: Math.max(0, top) })
  }

  await canvas.composite(composites).png().toFile(outputPath)
}

export { getBoardsRootPath, setBoardsRootPath }
