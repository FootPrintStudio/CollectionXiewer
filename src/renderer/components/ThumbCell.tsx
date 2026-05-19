import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react'
import type { IdentifierBadge, MediaItem, Tag } from '../../shared/types'
import { useMediaTagDrop } from '../dnd/useMediaTagDrop'
import { useMediaDrag } from '../dnd/useMediaDrag'
import { useAppStore } from '../store/appStore'
import { ThumbTagStrip } from './ThumbTagStrip'
import { ThumbIdentifierBadges } from './ThumbIdentifierBadges'

interface Props {
  item: MediaItem
  thumbTags?: Tag[]
  identifierBadges?: IdentifierBadge[]
  width?: number
  height?: number
  /** Longest on-screen edge in CSS px; drives requested thumb resolution. */
  pixelSize?: number
  /** Square cell that stretches to the grid column width. */
  fillGridCell?: boolean
  selected?: boolean
  primary?: boolean
  onClick: (e: MouseEvent) => void
  onDoubleClick: () => void
}

export function ThumbCell({
  item,
  width,
  height,
  pixelSize,
  fillGridCell,
  selected,
  primary,
  onClick,
  onDoubleClick,
  thumbTags = [],
  identifierBadges = []
}: Props) {
  const showThumbTagList = useAppStore((s) => s.showThumbTagList)
  const showIdentifiers = useAppStore((s) => s.showIdentifiers)
  const [src, setSrc] = useState<string | null>(null)
  const { setNodeRef: setDropRef, isDropHover } = useMediaTagDrop(item.id)
  const { attributes, listeners, setNodeRef: setDragRef, isDragging, dragCount } = useMediaDrag(item.id)

  useEffect(() => {
    if (!pixelSize) return
    let cancelled = false
    void window.collectionXiewer.thumb.get(item.id, pixelSize).then((b64) => {
      if (!cancelled && b64) setSrc(`data:image/jpeg;base64,${b64}`)
    })
    return () => {
      cancelled = true
    }
  }, [item.id, pixelSize])

  const style: CSSProperties = fillGridCell
    ? { width: '100%', height: 'auto', aspectRatio: '1' }
    : {
        width: width ?? '100%',
        height: height ?? width ?? 160,
        aspectRatio:
          width && height ? undefined : item.width && item.height ? `${item.width}/${item.height}` : '1'
      }

  const setRefs = (el: HTMLDivElement | null) => {
    setDropRef(el)
    setDragRef(el)
  }

  const dragHint =
    dragCount > 1
      ? ` (${dragCount} selected — drop on a collection in Collections Library)`
      : ' (drop on a collection in Collections Library)'

  return (
    <div
      ref={setRefs}
      className={`thumb-cell${fillGridCell ? ' thumb-cell--grid-fill' : ''}${selected ? ' selected' : ''}${primary ? ' thumb-cell--primary' : ''}${isDropHover ? ' media-tag-drop-hover' : ''}${isDragging ? ' thumb-cell--dragging' : ''}`}
      style={style}
      data-media-id={item.id}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={`${item.relative_path}${dragHint}; Shift+click range; double-click preview`}
      {...attributes}
      {...listeners}
    >
      <div className="thumb-cell__media">
        {src ? (
          <img src={src} alt="" draggable={false} />
        ) : (
          <div className="empty-hint thumb-cell__placeholder">
            {item.kind}
          </div>
        )}
      </div>
      {showIdentifiers ? <ThumbIdentifierBadges badges={identifierBadges} /> : null}
      {showThumbTagList ? <ThumbTagStrip tags={thumbTags} /> : null}
    </div>
  )
}
