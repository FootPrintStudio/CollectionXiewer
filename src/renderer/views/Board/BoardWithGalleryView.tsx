import { useCallback, useState } from 'react'
import { DesignBoardView } from './DesignBoardView'
import { GalleryView } from '../Gallery/GalleryView'
import {
  clampBoardGalleryHeight,
  loadBoardGalleryHeight,
  loadBoardGalleryOpen,
  saveBoardGalleryHeight,
  saveBoardGalleryOpen
} from '../../lib/boardGalleryPrefs'

export function BoardWithGalleryView() {
  const [stripOpen, setStripOpen] = useState(loadBoardGalleryOpen)
  const [stripHeight, setStripHeight] = useState(loadBoardGalleryHeight)

  const toggleStrip = () => {
    setStripOpen((open) => {
      const next = !open
      saveBoardGalleryOpen(next)
      return next
    })
  }

  const resizeStrip = useCallback((deltaY: number) => {
    setStripHeight((h) => clampBoardGalleryHeight(h - deltaY))
  }, [])

  const endResize = useCallback(() => {
    setStripHeight((h) => {
      saveBoardGalleryHeight(h)
      return h
    })
  }, [])

  return (
    <div className="board-split">
      <div className="board-split__main">
        <DesignBoardView onToggleGalleryStrip={toggleStrip} galleryStripOpen={stripOpen} />
      </div>
      {stripOpen && (
        <>
          <div
            className="board-split__resize"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize reference gallery"
            onPointerDown={(e) => {
              e.preventDefault()
              const handle = e.currentTarget
              handle.setPointerCapture(e.pointerId)
              let lastY = e.clientY
              const onMove = (ev: PointerEvent) => {
                const delta = ev.clientY - lastY
                lastY = ev.clientY
                resizeStrip(delta)
              }
              const onUp = (ev: PointerEvent) => {
                if (handle.hasPointerCapture(ev.pointerId)) {
                  handle.releasePointerCapture(ev.pointerId)
                }
                window.removeEventListener('pointermove', onMove)
                window.removeEventListener('pointerup', onUp)
                window.removeEventListener('pointercancel', onUp)
                document.body.classList.remove('panel-resize-active')
                endResize()
              }
              document.body.classList.add('panel-resize-active')
              window.addEventListener('pointermove', onMove)
              window.addEventListener('pointerup', onUp)
              window.addEventListener('pointercancel', onUp)
            }}
          />
          <section
            className="board-split__gallery"
            style={{ height: stripHeight }}
            aria-label="Reference gallery — drag thumbnails onto the board above"
          >
            <GalleryView />
          </section>
        </>
      )}
    </div>
  )
}

