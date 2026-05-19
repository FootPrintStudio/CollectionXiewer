import { extname } from 'node:path'
import type { MediaKind } from '../../shared/types'

export function isMotionMedia(kind: MediaKind | undefined, absolutePath: string): boolean {
  if (kind === 'motion') return true
  if (kind === 'image' || kind === 'video' || kind === 'unknown') return false
  const ext = extname(absolutePath).toLowerCase()
  return ext === '.gif' || ext === '.apng' || ext === '.webp'
}

/** Sharp read options for a single frame (crop/export). */
export function sharpReadOptions(
  absolutePath: string,
  kind?: MediaKind
): { animated: true; pages: number } | Record<string, never> {
  if (!isMotionMedia(kind, absolutePath)) return {}
  const ext = extname(absolutePath).toLowerCase()
  if (ext === '.gif') return {}
  return { animated: true, pages: 1 }
}

export function imageDimensionsFromMetadata(
  meta: { width?: number; height?: number; pages?: number }
): { width: number | null; height: number | null; pages: number } {
  const pages = meta.pages ?? 1
  const raw = meta as { pageWidth?: number; pageHeight?: number }
  const pageWidth = typeof raw.pageWidth === 'number' ? raw.pageWidth : undefined
  const pageHeight = typeof raw.pageHeight === 'number' ? raw.pageHeight : undefined
  let height = pageHeight
  if (!height && meta.height) {
    height = pages > 1 ? Math.round(meta.height / pages) : meta.height
  }
  return {
    width: pageWidth ?? meta.width ?? null,
    height: height ?? null,
    pages
  }
}
