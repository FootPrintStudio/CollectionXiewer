import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pause, Play, X } from 'lucide-react'
import type { MediaItem } from '../../shared/types'
import { useAppStore } from '../store/appStore'
import { ZoomablePreviewImage } from './ZoomablePreviewImage'
import { VideoPreviewPlayer } from './VideoPreviewPlayer'

function SlideshowSlide({ item, onVideoEnded }: { item: MediaItem; onVideoEnded?: () => void }) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setPreviewSrc(null)
    if (item.kind === 'video') return
    void window.collectionXiewer.preview.get(item.id, 2400).then((b64) => {
      if (!cancelled && b64) setPreviewSrc(`data:image/jpeg;base64,${b64}`)
    })
    return () => {
      cancelled = true
    }
  }, [item.id, item.kind])

  if (item.kind === 'video') {
    return (
      <VideoPreviewPlayer
        mediaId={item.id}
        src={`file://${item.absolute_path}`}
        className="slideshow-overlay__video"
        compact
        onEnded={onVideoEnded}
      />
    )
  }

  if (previewSrc) {
    return <ZoomablePreviewImage src={previewSrc} alt={item.relative_path} />
  }

  return <span className="empty-hint">Loading…</span>
}

export function SlideshowOverlay() {
  const media = useAppStore((s) => s.media)
  const slideshowOpen = useAppStore((s) => s.slideshowOpen)
  const slideshowIndex = useAppStore((s) => s.slideshowIndex)
  const slideshowPlaying = useAppStore((s) => s.slideshowPlaying)
  const slideshowIntervalSec = useAppStore((s) => s.slideshowIntervalSec)
  const closeSlideshow = useAppStore((s) => s.closeSlideshow)
  const setSlideshowIndex = useAppStore((s) => s.setSlideshowIndex)
  const setSlideshowPlaying = useAppStore((s) => s.setSlideshowPlaying)
  const setSlideshowIntervalSec = useAppStore((s) => s.setSlideshowIntervalSec)

  const item = media[slideshowIndex] ?? null
  const count = media.length

  const goRelative = useCallback(
    (delta: number) => {
      if (count === 0) return
      const next = (slideshowIndex + delta + count) % count
      setSlideshowIndex(next)
    },
    [count, slideshowIndex, setSlideshowIndex]
  )

  useEffect(() => {
    if (!slideshowOpen || !slideshowPlaying || count === 0) return
    if (item?.kind === 'video') return
    const id = window.setInterval(() => goRelative(1), slideshowIntervalSec * 1000)
    return () => window.clearInterval(id)
  }, [slideshowOpen, slideshowPlaying, slideshowIntervalSec, count, item?.kind, goRelative])

  useEffect(() => {
    if (!slideshowOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeSlideshow()
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        setSlideshowPlaying(!slideshowPlaying)
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goRelative(-1)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goRelative(1)
        return
      }
      if (e.key === 'Home') {
        e.preventDefault()
        setSlideshowIndex(0)
        return
      }
      if (e.key === 'End') {
        e.preventDefault()
        setSlideshowIndex(Math.max(0, count - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    slideshowOpen,
    slideshowPlaying,
    closeSlideshow,
    setSlideshowPlaying,
    goRelative,
    setSlideshowIndex,
    count
  ])

  if (!slideshowOpen || !item) return null

  return createPortal(
    <div className="slideshow-overlay" role="dialog" aria-label="Slideshow">
      <button
        type="button"
        className="slideshow-overlay__close"
        onClick={closeSlideshow}
        aria-label="Exit slideshow"
      >
        <X size={24} />
      </button>
      <div className="slideshow-overlay__stage">
        <SlideshowSlide
          key={item.id}
          item={item}
          onVideoEnded={slideshowPlaying ? () => goRelative(1) : undefined}
        />
      </div>
      <div className="slideshow-overlay__bar">
        <span>
          {slideshowIndex + 1} / {count}
        </span>
        <span className="slideshow-overlay__path" title={item.relative_path}>
          {item.relative_path}
        </span>
        <button
          type="button"
          onClick={() => setSlideshowPlaying(!slideshowPlaying)}
          aria-label={slideshowPlaying ? 'Pause' : 'Play'}
        >
          {slideshowPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <label className="slideshow-overlay__interval">
          Interval
          <select
            value={slideshowIntervalSec}
            onChange={(e) => setSlideshowIntervalSec(Number(e.target.value))}
            aria-label="Slide interval"
          >
            <option value={3}>3s</option>
            <option value={5}>5s</option>
            <option value={10}>10s</option>
          </select>
        </label>
        <button type="button" onClick={() => goRelative(-1)} disabled={count <= 1}>
          Previous
        </button>
        <button type="button" onClick={() => goRelative(1)} disabled={count <= 1}>
          Next
        </button>
        <button type="button" onClick={closeSlideshow}>
          Exit
        </button>
      </div>
    </div>,
    document.body
  )
}
