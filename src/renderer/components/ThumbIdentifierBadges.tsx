import type { IdentifierBadge } from '../../shared/types'

export function ThumbIdentifierBadges({ badges }: { badges: IdentifierBadge[] }) {
  if (badges.length === 0) return null

  return (
    <div className="thumb-identifier-badges" onPointerDown={(e) => e.stopPropagation()}>
      {badges.map((b) => (
        <span
          key={b.identifierId}
          className="thumb-identifier-badges__icon"
          style={{ color: b.color }}
          title={`${b.label}\n${b.query_text}`}
        >
          {b.icon}
        </span>
      ))}
    </div>
  )
}
