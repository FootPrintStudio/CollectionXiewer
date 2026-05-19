import type { Tag } from '../../shared/types'
import { formatTagLabel } from '../../shared/tagDisplay'
import { useResolvedTagColor } from '../hooks/useResolvedTagColor'
import { useResolvedTagIcon } from '../hooks/useResolvedTagIcon'
import { TagGlyph } from './TagGlyph'

interface TagChipContentProps {
  tag: Tag
  className?: string
}

export function TagChipContent({ tag, className }: TagChipContentProps) {
  const color = useResolvedTagColor(tag)
  const icon = useResolvedTagIcon(tag)

  return (
    <span className={className ? `tag-chip-content ${className}` : 'tag-chip-content'}>
      <TagGlyph icon={icon} color={color} className="tag-chip-content__glyph" />
      <span className="tag-chip-content__label">{formatTagLabel(tag)}</span>
    </span>
  )
}
