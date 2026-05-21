import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX
} from 'lucide-react'
import { mediaUrlFromPath } from '../lib/fileUrl'
import { isEditableTarget } from '../lib/keyboardTargets'
import {
  loadVideoLoop,
  loadVideoMuted,
  loadVideoVolume,
  saveVideoLoop,
  saveVideoMuted,
  saveVideoVolume
} from '../lib/videoPlayerPrefs'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
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
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const seekTrackRef = useRef<HTMLDivElement>(null)
  const scrubbingRef = useRef(false)
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bufferedEnd, setBufferedEnd] = useState(0)
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [savingPoster, setSavingPoster] = useState(false)
  const [volume, setVolume] = useState(loadVideoVolume)
  const [muted, setMuted] = useState(loadVideoMuted)
  const [loop, setLoop] = useState(loadVideoLoop)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  const revealControls = useCallback(() => {
    setControlsVisible(true)
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current)
    hideControlsTimer.current = setTimeout(() => {
      if (playing && isFullscreen) setControlsVisible(false)
    }, 2800)
  }, [playing, isFullscreen])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const path = await window.collectionXiewer.video.getPosterPath(mediaId)
      if (cancelled) return
      setPosterUrl(path ? mediaUrlFromPath(path) : null)
    })()
    return () => {
      cancelled = true
    }
  }, [mediaId])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = volume
    v.muted = muted
    v.loop = loop
  }, [volume, muted, loop, src])

  useEffect(() => {
    const onFs = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current)
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current)
    }
  }, [])

  const syncBuffered = useCallback(() => {
    const v = videoRef.current
    if (!v || !v.duration || v.buffered.length === 0) {
      setBufferedEnd(0)
      return
    }
    let end = 0
    for (let i = 0; i < v.buffered.length; i++) {
      end = Math.max(end, v.buffered.end(i))
    }
    setBufferedEnd(end)
  }, [])

  const seekToRatio = useCallback((ratio: number) => {
    const v = videoRef.current
    const dur = v?.duration
    if (!v || !dur || !Number.isFinite(dur) || dur <= 0) return
    const clamped = Math.max(0, Math.min(1, ratio))
    const t = clamped * dur
    if (!Number.isFinite(t)) return
    v.currentTime = t
    setCurrentTime(t)
  }, [])

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const track = seekTrackRef.current
      const v = videoRef.current
      if (!track || !v?.duration || !Number.isFinite(v.duration)) return
      const rect = track.getBoundingClientRect()
      if (rect.width <= 0) return
      const ratio = (clientX - rect.left) / rect.width
      seekToRatio(ratio)
    },
    [seekToRatio]
  )

  const onSeekPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    scrubbingRef.current = true
    seekFromClientX(e.clientX)
    e.currentTarget.setPointerCapture(e.pointerId)
    revealControls()
  }

  const onSeekPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return
    seekFromClientX(e.clientX)
  }

  const onSeekPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    scrubbingRef.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      void v.play()
    } else {
      v.pause()
    }
    revealControls()
  }, [revealControls])

  const step = useCallback(
    (delta: number) => {
      const v = videoRef.current
      if (!v) return
      v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta))
      revealControls()
    },
    [revealControls]
  )

  const setVolumeLevel = useCallback((next: number) => {
    const clamped = Math.min(1, Math.max(0, next))
    setVolume(clamped)
    saveVideoVolume(clamped)
    if (clamped > 0) {
      setMuted(false)
      saveVideoMuted(false)
    }
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      saveVideoMuted(next)
      return next
    })
    revealControls()
  }, [revealControls])

  const toggleLoop = useCallback(() => {
    setLoop((l) => {
      const next = !l
      saveVideoLoop(next)
      return next
    })
    revealControls()
  }, [revealControls])

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current
    if (!el) return
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen()
      } else {
        await el.requestFullscreen()
      }
    } catch {
      /* unsupported */
    }
    revealControls()
  }, [revealControls])

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
      if (path) setPosterUrl(mediaUrlFromPath(path))
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!containerRef.current?.isConnected) return
      if (isEditableTarget(e.target)) return

      let handled = false
      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          togglePlay()
          handled = true
          break
        case 'ArrowLeft':
          step(e.shiftKey ? -1 : -5)
          handled = true
          break
        case 'ArrowRight':
          step(e.shiftKey ? 1 : 5)
          handled = true
          break
        case 'ArrowUp': {
          e.preventDefault()
          setVolumeLevel(volume + (e.shiftKey ? 0.1 : 0.05))
          handled = true
          break
        }
        case 'ArrowDown': {
          e.preventDefault()
          setVolumeLevel(volume - (e.shiftKey ? 0.1 : 0.05))
          handled = true
          break
        }
        case 'm':
        case 'M':
          toggleMute()
          handled = true
          break
        case 'f':
        case 'F':
          void toggleFullscreen()
          handled = true
          break
        case 'Escape':
          if (document.fullscreenElement === containerRef.current) {
            void document.exitFullscreen()
            handled = true
          }
          break
        default:
          break
      }

      if (handled) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [togglePlay, step, toggleMute, toggleFullscreen, setVolumeLevel, volume])

  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufferedPct = duration > 0 ? (bufferedEnd / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      className={[
        'video-preview-player',
        isFullscreen ? 'video-preview-player--fullscreen' : '',
        controlsVisible ? '' : 'video-preview-player--controls-hidden',
        className ?? ''
      ]
        .filter(Boolean)
        .join(' ')}
      tabIndex={-1}
      onMouseMove={revealControls}
      onMouseLeave={() => {
        if (playing && isFullscreen) setControlsVisible(false)
      }}
    >
      <div className="video-preview-player__stage">
        <video
          ref={videoRef}
          className="video-preview-player__video"
          src={src}
          poster={posterUrl ?? undefined}
          preload="metadata"
          playsInline
          loop={loop}
          onLoadedMetadata={() => {
            const v = videoRef.current
            if (v) {
              setDuration(v.duration)
              syncBuffered()
            }
          }}
          onDurationChange={() => {
            const v = videoRef.current
            if (v) setDuration(v.duration)
          }}
          onSeeking={() => {
            const v = videoRef.current
            if (v) setCurrentTime(v.currentTime)
          }}
          onSeeked={() => {
            const v = videoRef.current
            if (v) setCurrentTime(v.currentTime)
            scrubbingRef.current = false
          }}
          onTimeUpdate={() => {
            if (scrubbingRef.current) return
            const v = videoRef.current
            if (v) setCurrentTime(v.currentTime)
          }}
          onProgress={syncBuffered}
          onPlay={() => {
            setPlaying(true)
            revealControls()
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            if (loop) {
              const v = videoRef.current
              if (v) {
                v.currentTime = 0
                void v.play()
              }
              return
            }
            setPlaying(false)
            setControlsVisible(true)
            onEnded?.()
          }}
          onDoubleClick={() => void toggleFullscreen()}
        />

        <div
          className="video-preview-player__hit"
          onClick={togglePlay}
          aria-hidden
        />

        {!playing ? (
          <button
            type="button"
            className="video-preview-player__center-play"
            title="Play"
            aria-label="Play"
            onClick={(e) => {
              e.stopPropagation()
              togglePlay()
            }}
          >
            <Play size={compact ? 36 : 52} aria-hidden />
          </button>
        ) : null}
      </div>

      <div
        className={`video-preview-player__bar${compact ? ' video-preview-player__bar--compact' : ''}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="video-preview-player__transport">
          <button
            type="button"
            title={playing ? 'Pause (k)' : 'Play (k)'}
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={togglePlay}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button type="button" title="Back 5s (←)" onClick={() => step(-5)} aria-label="Back five seconds">
            <SkipBack size={16} />
          </button>
          <button
            type="button"
            title="Forward 5s (→)"
            onClick={() => step(5)}
            aria-label="Forward five seconds"
          >
            <SkipForward size={16} />
          </button>

          <div className="video-preview-player__seek-wrap">
            <div
              ref={seekTrackRef}
              className="video-preview-player__seek-track"
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={duration || 0}
              aria-valuenow={currentTime}
              onPointerDown={onSeekPointerDown}
              onPointerMove={onSeekPointerMove}
              onPointerUp={onSeekPointerUp}
              onPointerCancel={onSeekPointerUp}
            >
              <div className="video-preview-player__seek-rail">
                <div
                  className="video-preview-player__seek-buffered"
                  style={{ width: `${bufferedPct}%` }}
                />
                <div
                  className="video-preview-player__seek-played"
                  style={{ width: `${playedPct}%` }}
                />
              </div>
              <div
                className="video-preview-player__seek-thumb"
                style={{ left: `${playedPct}%` }}
              />
            </div>
          </div>

          <span className="video-preview-player__time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="video-preview-player__secondary">
          <div className="video-preview-player__volume">
            <button
              type="button"
              title={muted ? 'Unmute (m)' : 'Mute (m)'}
              aria-label={muted ? 'Unmute' : 'Mute'}
              onClick={toggleMute}
            >
              {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              className="video-preview-player__volume-slider"
              min={0}
              max={1}
              step={0.02}
              value={muted ? 0 : volume}
              onChange={(e) => setVolumeLevel(Number(e.target.value))}
              aria-label="Volume"
            />
          </div>

          <button
            type="button"
            className={`video-preview-player__loop${loop ? ' video-preview-player__loop--on' : ''}`}
            title={loop ? 'Loop on (click to turn off)' : 'Loop off (click to loop)'}
            aria-label={loop ? 'Disable loop' : 'Enable loop'}
            aria-pressed={loop}
            onClick={toggleLoop}
          >
            <Repeat size={16} aria-hidden />
            <span className="video-preview-player__loop-label">Loop</span>
          </button>

          <button
            type="button"
            title={isFullscreen ? 'Exit fullscreen (f)' : 'Fullscreen (f)'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={() => void toggleFullscreen()}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>

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
    </div>
  )
}
