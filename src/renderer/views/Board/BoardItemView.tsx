import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardItem, BoardMediaItem, BoardNoteItem } from '../../../shared/boardSchema'
import { mediaAspectRatio } from '../../../shared/mediaDimensions'
import { mediaItemAspect, snapMediaItemToAspect } from '../../lib/boardItemTransforms'
import { useBoardStore } from '../../store/boardStore'
import { useAppStore } from '../../store/appStore'
import { BoardItemHandles } from './BoardItemHandles'

interface Props {
  item: BoardItem
  selected: boolean
  camera: { x: number; y: number; scale: number }
  getViewportRect: () => DOMRect | undefined
  onPointerDown: (e: React.PointerEvent) => void
}

function MediaItemView({
  item,
  onAspectKnown
}: {
  item: BoardMediaItem
  onAspectKnown: (aspect: number, fromNatural: boolean) => void
}) {
  const missing = useBoardStore((s) => s.mediaMissing.has(item.mediaId))
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const media = await window.collectionXiewer.media.get(item.mediaId)
      if (cancelled) return
      if (media) {
        const aspect = mediaAspectRatio(media.width, media.height, media.kind, media.crop)
        onAspectKnown(aspect, false)
      }
      let b64 = await window.collectionXiewer.preview.get(item.mediaId, 1200)
      if (!b64) {
        b64 = await window.collectionXiewer.thumb.get(item.mediaId, 800)
      }
      if (cancelled) return
      setSrc(b64 ? `data:image/jpeg;base64,${b64}` : null)
    })()
    return () => {
      cancelled = true
    }
  }, [item.mediaId, onAspectKnown])

  const remove = () => {
    const st = useBoardStore.getState()
    const doc = st.document
    if (!doc) return
    st.setItems(doc.items.filter((i) => i.id !== item.id))
    const next = st.selection.filter((id) => id !== item.id)
    const anchor =
      st.selectionAnchorId === item.id ? (next[0] ?? null) : st.selectionAnchorId
    st.setSelection(next, { anchorId: anchor })
  }

  if (missing) {
    return (
      <div className="board-item__missing">
        <span>Media missing</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); remove() }}>
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

export function BoardItemView({
  item,
  selected,
  camera,
  getViewportRect,
  onPointerDown
}: Props) {
  const openPreview = useAppStore((s) => s.openPreview)
  const updateItem = useBoardStore((s) => s.updateItem)
  const aspectSnappedRef = useRef(false)

  const flipScale =
    item.kind === 'media'
      ? `scale(${item.flipX ? -1 : 1}, ${item.flipY ? -1 : 1})`
      : ''

  const onAspectKnown = useCallback(
    (aspect: number, fromNatural: boolean) => {
      if (item.kind !== 'media' || aspect <= 0) return
      const current = item.aspectRatio ?? item.width / Math.max(item.height, 1)
      const drift = Math.abs(current - aspect) / aspect
      if (!item.aspectRatio || (fromNatural && drift > 0.02 && !aspectSnappedRef.current)) {
        aspectSnappedRef.current = true
        updateItem(item.id, snapMediaItemToAspect(item, aspect))
      } else if (!item.aspectRatio) {
        updateItem(item.id, { aspectRatio: aspect })
      }
    },
    [item, updateItem]
  )

  const lockAspect = item.kind === 'media' ? mediaItemAspect(item) : null

  const frameStyle: React.CSSProperties = {
    left: item.x,
    top: item.y,
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
          <MediaItemView item={item} onAspectKnown={onAspectKnown} />
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
}
