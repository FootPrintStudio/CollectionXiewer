import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { BoardItem, BoardNoteItem } from '../../../shared/boardSchema'
import { mediaAspectRatio } from '../../../shared/mediaDimensions'
import { mediaItemAspect, snapMediaItemToAspect } from '../../lib/boardItemTransforms'
import { jpegBase64ToObjectUrl, revokeObjectUrl } from '../../lib/blobUrl'
import { useBoardStore } from '../../store/boardStore'
import { useAppStore } from '../../store/appStore'
import { BoardItemHandles } from './BoardItemHandles'

interface Props {
  item: BoardItem
  selected: boolean
  camera: { x: number; y: number; scale: number }
  getViewportRect: () => DOMRect | undefined
  onPointerDown: (e: React.PointerEvent) => void
  /** Live position while dragging; store coords stay unchanged until pointerup. */
  dragPosition?: { x: number; y: number } | null
}

function MediaItemView({
  mediaId,
  onAspectKnown
}: {
  mediaId: number
  onAspectKnown: (aspect: number, fromNatural: boolean) => void
}) {
  const missing = useBoardStore((s) => s.mediaMissing.has(mediaId))
  const [src, setSrc] = useState<string | null>(null)
  const onAspectKnownRef = useRef(onAspectKnown)
  onAspectKnownRef.current = onAspectKnown

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    setSrc(null)
    void (async () => {
      const media = await window.collectionXiewer.media.get(mediaId)
      if (cancelled) return
      if (media) {
        const aspect = mediaAspectRatio(media.width, media.height, media.kind, media.crop)
        onAspectKnownRef.current(aspect, false)
      }
      let b64 = await window.collectionXiewer.preview.get(mediaId, 1200)
      if (!b64) {
        b64 = await window.collectionXiewer.thumb.get(mediaId, 800)
      }
      if (cancelled || !b64) return
      objectUrl = jpegBase64ToObjectUrl(b64)
      setSrc(objectUrl)
    })()
    return () => {
      cancelled = true
      revokeObjectUrl(objectUrl)
    }
  }, [mediaId])

  const remove = () => {
    const st = useBoardStore.getState()
    const doc = st.document
    if (!doc) return
    const target = doc.items.find((i) => i.kind === 'media' && i.mediaId === mediaId)
    if (!target) return
    st.setItems(doc.items.filter((i) => i.id !== target.id))
    const next = st.selection.filter((id) => id !== target.id)
    const anchor =
      st.selectionAnchorId === target.id ? (next[0] ?? null) : st.selectionAnchorId
    st.setSelection(next, { anchorId: anchor })
  }

  if (missing) {
    return (
      <div className="board-item__missing">
        <span>Media missing</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            remove()
          }}
        >
          Remove
        </button>
      </div>
    )
  }

  return src ? (
    <img
      src={src}
      alt=""
      draggable={false}
      className="board-item__img"
      onLoad={(e) => {
        const img = e.currentTarget
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          onAspectKnown(img.naturalWidth / img.naturalHeight, true)
        }
      }}
    />
  ) : (
    <div className="board-item__loading">Loading…</div>
  )
}

function NoteItemView({ item }: { item: BoardNoteItem }) {
  const updateItem = useBoardStore((s) => s.updateItem)
  return (
    <textarea
      className="board-item__note"
      value={item.text}
      readOnly={item.locked}
      style={{ fontSize: item.fontSize, color: item.color }}
      onChange={(e) => updateItem(item.id, { text: e.target.value })}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label="Board note"
    />
  )
}

export const BoardItemView = memo(function BoardItemView({
  item,
  selected,
  camera,
  getViewportRect,
  onPointerDown,
  dragPosition
}: Props) {
  const openPreview = useAppStore((s) => s.openPreview)
  const updateItem = useBoardStore((s) => s.updateItem)
  const aspectSnappedRef = useRef(false)
  const itemId = item.id

  useEffect(() => {
    aspectSnappedRef.current = false
  }, [item.kind === 'media' ? item.mediaId : itemId])

  const flipScale =
    item.kind === 'media'
      ? `scale(${item.flipX ? -1 : 1}, ${item.flipY ? -1 : 1})`
      : ''

  const onAspectKnown = useCallback(
    (aspect: number, fromNatural: boolean) => {
      if (aspect <= 0) return
      const st = useBoardStore.getState()
      const current = st.document?.items.find((i) => i.id === itemId)
      if (!current || current.kind !== 'media') return
      const ratio = current.aspectRatio ?? current.width / Math.max(current.height, 1)
      const drift = Math.abs(ratio - aspect) / aspect
      if (!current.aspectRatio || (fromNatural && drift > 0.02 && !aspectSnappedRef.current)) {
        aspectSnappedRef.current = true
        updateItem(current.id, snapMediaItemToAspect(current, aspect))
      } else if (!current.aspectRatio) {
        updateItem(current.id, { aspectRatio: aspect })
      }
    },
    [itemId, updateItem]
  )

  const lockAspect = item.kind === 'media' ? mediaItemAspect(item) : null
  const left = dragPosition?.x ?? item.x
  const top = dragPosition?.y ?? item.y

  const frameStyle: React.CSSProperties = {
    left,
    top,
    width: item.width,
    height: item.height,
    zIndex: item.zIndex,
    opacity: item.kind === 'media' ? item.opacity : 1
  }

  const transformStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    transform: `rotate(${item.rotation}deg) ${flipScale}`.trim(),
    transformOrigin: 'center center'
  }

  return (
    <div
      className={`board-item${selected ? ' board-item--selected' : ''}${item.locked ? ' board-item--locked' : ''}`}
      style={frameStyle}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (item.kind === 'media') openPreview(item.mediaId)
      }}
    >
      <div className="board-item__transform" style={transformStyle}>
        {item.kind === 'media' ? (
          <MediaItemView mediaId={item.mediaId} onAspectKnown={onAspectKnown} />
        ) : (
          <NoteItemView item={item} />
        )}
        {selected && !item.locked && (
          <BoardItemHandles
            item={item}
            camera={camera}
            viewportRect={getViewportRect}
            lockAspect={lockAspect}
          />
        )}
      </div>
    </div>
  )
}, boardItemPropsEqual)

function boardItemPropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.item === next.item &&
    prev.selected === next.selected &&
    prev.camera.x === next.camera.x &&
    prev.camera.y === next.camera.y &&
    prev.camera.scale === next.camera.scale &&
    prev.dragPosition?.x === next.dragPosition?.x &&
    prev.dragPosition?.y === next.dragPosition?.y
  )
}
