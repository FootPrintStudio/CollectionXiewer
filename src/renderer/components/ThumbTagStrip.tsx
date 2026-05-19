import { useState } from 'react'
import type { Tag } from '../../shared/types'
import { tagChipStyle } from '../lib/tagChipStyle'
import { useResolvedTagColor } from '../hooks/useResolvedTagColor'
import { TagChipContent } from './TagChipContent'

function ThumbTagChip({ tag, compact }: { tag: Tag; compact?: boolean }) {
  const color = useResolvedTagColor(tag)
  return (
    <span
      className={`chip thumb-tag-strip__chip${compact ? ' thumb-tag-strip__chip--compact' : ''}`}
      style={tagChipStyle(color)}
    >
      <TagChipContent tag={tag} />
    </span>
  )
}

const COLLAPSED_VISIBLE = 4

export function ThumbTagStrip({ tags }: { tags: Tag[] }) {
  const [expanded, setExpanded] = useState(false)

  if (tags.length === 0) return null

  const collapsedTags = tags.slice(0, COLLAPSED_VISIBLE)
  const moreCount = tags.length - collapsedTags.length

  return (
    <div
      className={`thumb-tag-strip${expanded ? ' thumb-tag-strip--expanded' : ''}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {expanded ? (
        <div className="thumb-tag-strip__panel">
          <div className="thumb-tag-strip__chip-list">
            {tags.map((tag) => (
              <ThumbTagChip key={tag.id} tag={tag} />
            ))}
          </div>
        </div>
      ) : null}
      <div className="thumb-tag-strip__collapsed">
        <div className="thumb-tag-strip__chip-list thumb-tag-strip__chip-list--collapsed">
          {collapsedTags.map((tag) => (
            <ThumbTagChip key={tag.id} tag={tag} compact />
          ))}
          {moreCount > 0 ? (
            <span className="chip thumb-tag-strip__chip thumb-tag-strip__chip--more">
              +{moreCount}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
