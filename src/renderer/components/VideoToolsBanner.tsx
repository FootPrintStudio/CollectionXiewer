import { useEffect, useState } from 'react'

export function VideoToolsBanner() {
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    void window.collectionXiewer.video.toolsAvailable().then((ok) => setMissing(!ok))
  }, [])

  if (!missing) return null

  return (
    <div className="app-banner app-banner--warning" role="status">
      ffmpeg/ffprobe not found on PATH — video thumbnails and metadata will not work. Install ffmpeg
      or set FFMPEG_PATH / FFPROBE_PATH (see README).
    </div>
  )
}
