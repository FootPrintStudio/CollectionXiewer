import type { CSSProperties } from 'react'

interface TagGlyphProps {
  icon: string | null | undefined
  color: string
  className?: string
  style?: CSSProperties
}

export function TagGlyph({ icon, color, className, style }: TagGlyphProps) {
  if (!icon) return null
  return (
    <span
      className={className ? `tag-glyph ${className}` : 'tag-glyph'}
      style={{ color, ...style }}
      aria-hidden
    >
      {icon}
    </span>
  )
}
