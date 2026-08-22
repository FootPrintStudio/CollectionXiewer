import { memo, useEffect, useState, type CSSProperties, type MouseEvent } from 'react'
import { mediaAspectRatioCss } from '../../shared/mediaDimensions'
import type { IdentifierBadge, MediaItem, Tag } from '../../shared/types'
import { useMediaTagDrop } from '../dnd/useMediaTagDrop'
import { useMediaDrag } from '../dnd/useMediaDrag'
import { useRegisterVisibleMedia } from '../hooks/visibleMediaIds'
import { jpegBase64ToObjectUrl, revokeObjectUrl } from '../lib/blobUrl'
import { fetchThumbBase64 } from '../lib/thumbFetch'
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
  /** Fixed square grid cell; image is letterboxed with object-fit: contain. */
  fillGridCell?: boolean
  selected?: boolean
  primary?: boolean
  onClick: (e: MouseEvent) => void
  onDoubleClick: () => void
}

function thumbPropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.item.id === next.item.id &&
    prev.item.width === next.item.width &&
    prev.item.height === next.item.height &&
    prev.item.kind === next.item.kind &&
    prev.item.relative_path === next.item.relative_path &&
    prev.item.crop === next.item.crop &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.pixelSize === next.pixelSize &&
    prev.fillGridCell === next.fillGridCell &&
    prev.selected === next.selected &&
    prev.primary === next.primary &&
    prev.thumbTags === next.thumbTags &&
    prev.identifierBadges === next.identifierBadges
  )
}

function ThumbCellImpl({
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
  useRegisterVisibleMedia(item.id)

  useEffect(() => {
    if (!pixelSize) return
    let cancelled = false
    let objectUrl: string | null = null
    setSrc(null)
    void fetchThumbBase64(item.id, pixelSize).then((b64) => {
      if (cancelled || !b64) return
      objectUrl = jpegBase64ToObjectUrl(b64)
      setSrc(objectUrl)
    })
    return () => {
      cancelled = true
      revokeObjectUrl(objectUrl)
    }
  }, [item.id, pixelSize])

  const style: CSSProperties = fillGridCell
    ? {
        width: '100%',
        height: 'auto',
        aspectRatio: '1'
      }
    : {
        width: width ?? '100%',
        height: height ?? width ?? 160,
        aspectRatio: width && height ? undefined : mediaAspectRatioCss(item.width, item.height, item.kind, item.crop)
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

export const ThumbCell = memo(ThumbCellImpl, thumbPropsEqual)
