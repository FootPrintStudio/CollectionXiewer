import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export interface VideoPreviewPlayerProps {
  mediaId: number
  src: string
  className?: string
  compact?: boolean
  onPosterSaved?: () => void
  onEnded?: () => void
}

export function VideoPreviewPlayer({
  mediaId,
  src,
  className,
  compact = false,
  onPosterSaved,
  onEnded
}: VideoPreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [savingPoster, setSavingPoster] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const path = await window.collectionXiewer.video.getPosterPath(mediaId)
      if (cancelled) return
      if (path) setPosterUrl(`file://${path}`)
      else setPosterUrl(null)
    })()
    return () => {
      cancelled = true
    }
  }, [mediaId])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      void v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }, [])

  const step = useCallback((delta: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta))
  }, [])

  const capturePoster = useCallback(async () => {
    const v = videoRef.current
    if (!v || v.videoWidth === 0) return
    setSavingPoster(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = v.videoWidth
      canvas.height = v.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(v, 0, 0)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92)
      )
      if (!blob) return
      const buf = new Uint8Array(await blob.arrayBuffer())
      await window.collectionXiewer.video.setPoster(mediaId, buf, v.currentTime * 1000)
      const path = await window.collectionXiewer.video.getPosterPath(mediaId)
      if (path) setPosterUrl(`file://${path}`)
      onPosterSaved?.()
    } finally {
      setSavingPoster(false)
    }
  }, [mediaId, onPosterSaved])

  const clearPoster = useCallback(async () => {
    await window.collectionXiewer.video.clearPoster(mediaId)
    setPosterUrl(null)
    onPosterSaved?.()
  }, [mediaId, onPosterSaved])

  return (
    <div className={`video-preview-player${className ? ` ${className}` : ''}`}>
      <video
        ref={videoRef}
        className="video-preview-player__video"
        src={src}
        poster={posterUrl ?? undefined}
        preload="metadata"
        onLoadedMetadata={() => {
          const v = videoRef.current
          if (v) setDuration(v.duration)
        }}
        onTimeUpdate={() => {
          const v = videoRef.current
          if (v) setCurrentTime(v.currentTime)
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          onEnded?.()
        }}
        onClick={togglePlay}
      />
      <div className={`video-preview-player__controls${compact ? ' video-preview-player__controls--compact' : ''}`}>
        <button type="button" title={playing ? 'Pause' : 'Play'} onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button type="button" title="Back 1s" onClick={() => step(-1)} aria-label="Back one second">
          <SkipBack size={16} />
        </button>
        <input
          type="range"
          className="video-preview-player__scrubber"
          min={0}
          max={duration || 0}
          step={0.05}
          value={currentTime}
          onChange={(e) => {
            const t = Number(e.target.value)
            const v = videoRef.current
            if (v) v.currentTime = t
            setCurrentTime(t)
          }}
          aria-label="Seek"
        />
        <button type="button" title="Forward 1s" onClick={() => step(1)} aria-label="Forward one second">
          <SkipForward size={16} />
        </button>
        <span className="video-preview-player__time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        {!compact ? (
          <>
            <button
              type="button"
              className="primary"
              disabled={savingPoster}
              onClick={() => void capturePoster()}
            >
              {savingPoster ? 'Saving…' : 'Set poster frame'}
            </button>
            {posterUrl ? (
              <button type="button" onClick={() => void clearPoster()}>
                Clear poster
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
