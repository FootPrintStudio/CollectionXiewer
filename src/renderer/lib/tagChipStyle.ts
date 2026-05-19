import type { CSSProperties } from 'react'

export function tagChipStyle(color: string | null | undefined): CSSProperties | undefined {
  if (!color) return undefined
  return {
    borderColor: color,
    background: `${color}33`
  }
}
