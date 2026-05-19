import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { MediaItem } from '../../../shared/types'
import { ThumbCell } from '../../components/ThumbCell'
import { useContainerWidth } from '../../hooks/useContainerWidth'
import { useGalleryMarquee } from '../../hooks/useGalleryMarquee'
import {
  computeColumnWidth,
  computeGridColumnCount,
  GRID_GAP_PX,
  mediaAspectRatio,
  thumbPixelSizeForDisplay
} from '../../lib/galleryLayout'
import { packHorizontalMasonryRows } from '../../lib/horizontalMasonryLayout'
import { packMasonryColumns } from '../../lib/masonryLayout'
import { useAppStore } from '../../store/appStore'
import { useGalleryThumbTags } from '../../hooks/useGalleryThumbTags'
import { useGalleryIdentifierBadges } from '../../hooks/useGalleryIdentifierBadges'

const H_MASONRY_ROW_HEIGHT_FACTOR = 0.75

function GalleryArea({
  areaRef,
  children
}: {
  areaRef: (node: HTMLDivElement | null) => void
  children: ReactNode
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const setSelectedMediaIds = useAppStore((s) => s.setSelectedMediaIds)
  const clearMediaSelection = useAppStore((s) => s.clearMediaSelection)
  const selectedMediaIds = useAppStore((s) => s.selectedMediaIds)

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node
      areaRef(node)
    },
    [areaRef]
  )

  const onMarqueeSelect = useCallback(
    (ids: number[], { additive }: { additive: boolean }) => {
      if (ids.length === 0) {
        clearMediaSelection()
        return
      }
      if (additive) {
        setSelectedMediaIds([...new Set([...selectedMediaIds, ...ids])])
      } else {
        setSelectedMediaIds(ids)
      }
    },
    [clearMediaSelection, selectedMediaIds, setSelectedMediaIds]
  )

  const { marquee, onPointerDown } = useGalleryMarquee(containerRef, onMarqueeSelect)

  return (
    <div ref={setRef} className="gallery-area" onPointerDown={onPointerDown}>
      {children}
      {marquee ? (
        <div
          className="gallery-marquee"
          style={{
            left: marquee.left,
            top: marquee.top,
            width: marquee.width,
            height: marquee.height
          }}
        />
      ) : null}
    </div>
  )
}

type ThumbHandlers = {
  onThumbClick: (id: number, e: React.MouseEvent) => void
  onThumbDoubleClick: (id: number) => void
  thumbOverlayProps: (mediaId: number) => Record<string, unknown>
  isMediaSelected: (id: number) => boolean
  selectedMediaId: number | null
}

function VirtualMasonryColumn({
  column,
  columnWidth,
  scrollRef,
  handlers
}: {
  column: MediaItem[]
  columnWidth: number
  scrollRef: React.RefObject<HTMLDivElement | null>
  handlers: ThumbHandlers
}) {
  const {
    onThumbClick,
    onThumbDoubleClick,
    thumbOverlayProps,
    isMediaSelected,
    selectedMediaId
  } = handlers

  const virtualizer = useVirtualizer({
    count: column.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const item = column[index]
      if (!item) return columnWidth + GRID_GAP_PX
      return columnWidth / mediaAspectRatio(item) + GRID_GAP_PX
    },
    overscan: 4
  })

  return (
    <div
      className="masonry-gallery__column"
      style={{ width: columnWidth, position: 'relative', height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((vi) => {
        const item = column[vi.index]
        if (!item) return null
        const thumbHeight = columnWidth / mediaAspectRatio(item)
        const displayEdge = Math.max(columnWidth, thumbHeight)
        return (
          <div
            key={vi.key}
            style={{
              position: 'absolute',
              top: vi.start,
              left: 0,
              width: columnWidth
            }}
          >
            <ThumbCell
              item={item}
              width={columnWidth}
              height={thumbHeight}
              pixelSize={thumbPixelSizeForDisplay(displayEdge)}
              selected={isMediaSelected(item.id)}
              primary={selectedMediaId === item.id}
              onClick={(e) => onThumbClick(item.id, e)}
              onDoubleClick={() => onThumbDoubleClick(item.id)}
              {...thumbOverlayProps(item.id)}
            />
          </div>
        )
      })}
    </div>
  )
}

function chunkMediaRows(items: MediaItem[], columnCount: number): MediaItem[][] {
  const rows: MediaItem[][] = []
  for (let i = 0; i < items.length; i += columnCount) {
    rows.push(items.slice(i, i + columnCount))
  }
  return rows
}

export function GalleryView() {
  const media = useAppStore((s) => s.media)
  const galleryMode = useAppStore((s) => s.galleryMode)
  const gridSize = useAppStore((s) => s.gridSize)
  const selectedMediaId = useAppStore((s) => s.selectedMediaId)
  const isMediaSelected = useAppStore((s) => s.isMediaSelected)
  const selectMediaItem = useAppStore((s) => s.selectMediaItem)
  const clearMediaSelection = useAppStore((s) => s.clearMediaSelection)
  const openPreview = useAppStore((s) => s.openPreview)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const { ref: measureGalleryWidth, width: galleryAreaWidth } = useContainerWidth<HTMLDivElement>()
  const thumbTagsMap = useGalleryThumbTags()
  const identifierBadgesMap = useGalleryIdentifierBadges()

  const thumbOverlayProps = useCallback(
    (mediaId: number) => ({
      thumbTags: thumbTagsMap[mediaId] ?? [],
      identifierBadges: identifierBadgesMap[mediaId] ?? []
    }),
    [thumbTagsMap, identifierBadgesMap]
  )

  const galleryAreaRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node
      measureGalleryWidth(node)
    },
    [measureGalleryWidth]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearMediaSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearMediaSelection])

  const onThumbClick = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    selectMediaItem(id, {
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey
    })
  }

  const onThumbDoubleClick = (id: number) => {
    openPreview(id)
  }

  const thumbHandlers: ThumbHandlers = {
    onThumbClick,
    onThumbDoubleClick,
    thumbOverlayProps,
    isMediaSelected,
    selectedMediaId
  }

  const containerWidth = galleryAreaWidth || scrollRef.current?.clientWidth || 800

  const columnCount = useMemo(
    () => computeGridColumnCount(containerWidth, gridSize),
    [containerWidth, gridSize]
  )

  const columnWidth = useMemo(
    () => computeColumnWidth(containerWidth, columnCount, GRID_GAP_PX),
    [containerWidth, columnCount]
  )

  const gridThumbPixelSize = useMemo(
    () => thumbPixelSizeForDisplay(columnWidth),
    [columnWidth]
  )

  const gridRows = useMemo(
    () => (galleryMode === 'grid' ? chunkMediaRows(media, columnCount) : []),
    [media, galleryMode, columnCount]
  )

  const gridRowEstimate = columnWidth + GRID_GAP_PX

  const gridVirtualizer = useVirtualizer({
    count: galleryMode === 'grid' ? gridRows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => gridRowEstimate,
    overscan: 3
  })

  const masonryColumns = useMemo(
    () =>
      galleryMode === 'masonry'
        ? packMasonryColumns(media, columnCount, columnWidth, GRID_GAP_PX)
        : [],
    [media, galleryMode, columnCount, columnWidth]
  )

  const targetRowHeight = gridSize * H_MASONRY_ROW_HEIGHT_FACTOR

  const hRows = useMemo(
    () =>
      galleryMode === 'horizontal'
        ? packHorizontalMasonryRows(media, containerWidth, targetRowHeight, GRID_GAP_PX)
        : [],
    [media, galleryMode, containerWidth, targetRowHeight]
  )

  const rowVirtualizer = useVirtualizer({
    count: galleryMode === 'horizontal' ? hRows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (hRows[index]?.height ?? targetRowHeight) + GRID_GAP_PX,
    overscan: 3
  })

  useEffect(() => {
    if (galleryMode === 'horizontal') rowVirtualizer.measure()
  }, [galleryMode, hRows, containerWidth, targetRowHeight, rowVirtualizer])

  useEffect(() => {
    if (galleryMode === 'grid') gridVirtualizer.measure()
  }, [galleryMode, gridRows, columnWidth, gridSize, gridVirtualizer])

  if (media.length === 0) {
    return <div className="empty-hint">No media indexed. Add a watch folder to begin.</div>
  }

  if (galleryMode === 'grid') {
    return (
      <GalleryArea areaRef={galleryAreaRef}>
        <div
          className="grid-gallery grid-gallery--virtual"
          style={{ height: gridVirtualizer.getTotalSize(), position: 'relative' }}
        >
          {gridVirtualizer.getVirtualItems().map((vi) => {
            const row = gridRows[vi.index]
            if (!row) return null
            return (
              <div
                key={vi.key}
                className="grid-gallery__row"
                style={{
                  position: 'absolute',
                  top: vi.start,
                  left: 0,
                  width: containerWidth,
                  display: 'grid',
                  gap: GRID_GAP_PX,
                  gridTemplateColumns: `repeat(${columnCount}, minmax(${gridSize}px, 1fr))`
                }}
              >
                {row.map((item) => (
                  <ThumbCell
                    key={item.id}
                    item={item}
                    fillGridCell
                    pixelSize={gridThumbPixelSize}
                    selected={isMediaSelected(item.id)}
                    primary={selectedMediaId === item.id}
                    onClick={(e) => onThumbClick(item.id, e)}
                    onDoubleClick={() => onThumbDoubleClick(item.id)}
                    {...thumbOverlayProps(item.id)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </GalleryArea>
    )
  }

  if (galleryMode === 'masonry') {
    return (
      <GalleryArea areaRef={galleryAreaRef}>
        <div className="masonry-gallery">
          {masonryColumns.map((column, colIndex) => (
            <VirtualMasonryColumn
              key={colIndex}
              column={column}
              columnWidth={columnWidth}
              scrollRef={scrollRef}
              handlers={thumbHandlers}
            />
          ))}
        </div>
      </GalleryArea>
    )
  }

  return (
    <GalleryArea areaRef={galleryAreaRef}>
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((vi) => {
          const row = hRows[vi.index]
          if (!row) return null
          return (
            <div
              key={vi.key}
              className="h-masonry-row"
              style={{
                position: 'absolute',
                top: vi.start,
                left: 0,
                width: containerWidth,
                height: row.height
              }}
            >
              {row.items.map((item, i) => (
                <ThumbCell
                  key={item.id}
                  item={item}
                  width={row.widths[i]}
                  height={row.height}
                  pixelSize={thumbPixelSizeForDisplay(Math.max(row.widths[i], row.height))}
                  selected={isMediaSelected(item.id)}
                  primary={selectedMediaId === item.id}
                  onClick={(e) => onThumbClick(item.id, e)}
                  onDoubleClick={() => onThumbDoubleClick(item.id)}
                  {...thumbOverlayProps(item.id)}
                />
              ))}
            </div>
          )
        })}
      </div>
    </GalleryArea>
  )
}
