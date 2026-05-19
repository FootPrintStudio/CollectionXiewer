import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getSharp } from './lazyNative'

const execFileAsync = promisify(execFile)

const PROBE_TIMEOUT_MS = 30_000
const FRAME_TIMEOUT_MS = 120_000
const MAX_FRAME_BYTES = 20 * 1024 * 1024

export interface VideoProbe {
  width: number
  height: number
  durationMs: number | null
}

let ffmpegCmd: string | null | undefined
let ffprobeCmd: string | null | undefined
let toolsChecked = false
let toolsAvailable = false

function envBinary(name: 'FFMPEG_PATH' | 'FFPROBE_PATH'): string | null {
  const value = process.env[name]?.trim()
  return value || null
}

async function canRun(cmd: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(cmd, args, { timeout: 5_000 })
    return true
  } catch {
    return false
  }
}

/** Returns whether ffmpeg/ffprobe are available (cached after first check). */
export async function ensureVideoTools(): Promise<boolean> {
  if (toolsChecked) return toolsAvailable
  toolsChecked = true

  ffmpegCmd = envBinary('FFMPEG_PATH') ?? 'ffmpeg'
  ffprobeCmd = envBinary('FFPROBE_PATH') ?? 'ffprobe'

  const ffmpegOk = await canRun(ffmpegCmd, ['-version'])
  const ffprobeOk = await canRun(ffprobeCmd, ['-version'])
  toolsAvailable = ffmpegOk && ffprobeOk

  if (!toolsAvailable) {
    console.warn(
      '[video] ffmpeg/ffprobe not found — install ffmpeg for video thumbnails (set FFMPEG_PATH / FFPROBE_PATH to override)'
    )
  }

  return toolsAvailable
}

export function pickSeekSeconds(durationMs: number | null): number {
  if (!durationMs || durationMs <= 0) return 1
  const durSec = durationMs / 1000
  if (durSec <= 0.5) return 0
  if (durSec < 3) return durSec / 2
  return Math.min(3, durSec * 0.1)
}

export async function probeVideoStream(absolutePath: string): Promise<VideoProbe | null> {
  if (!(await ensureVideoTools())) return null

  try {
    const { stdout } = await execFileAsync(
      ffprobeCmd!,
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height,duration',
        '-of',
        'json',
        absolutePath
      ],
      { timeout: PROBE_TIMEOUT_MS, maxBuffer: 1024 * 1024, encoding: 'utf8' }
    )

    const parsed = JSON.parse(stdout) as {
      streams?: Array<{ width?: number; height?: number; duration?: string }>
    }
    const stream = parsed.streams?.[0]
    if (!stream?.width || !stream?.height) return null

    const durationSec = stream.duration ? Number.parseFloat(stream.duration) : Number.NaN
    const durationMs =
      Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec * 1000) : null

    return {
      width: stream.width,
      height: stream.height,
      durationMs
    }
  } catch (err) {
    console.warn(
      '[video] probe failed:',
      absolutePath,
      err instanceof Error ? err.message : err
    )
    return null
  }
}

/** Extract a single MJPEG frame from a video file. */
export async function extractVideoFrameJpeg(
  absolutePath: string,
  seekSeconds?: number
): Promise<Buffer | null> {
  if (!(await ensureVideoTools())) return null

  const probe = await probeVideoStream(absolutePath)
  const seek = seekSeconds ?? pickSeekSeconds(probe?.durationMs ?? null)

  try {
    const { stdout } = await execFileAsync(
      ffmpegCmd!,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-ss',
        String(seek),
        '-i',
        absolutePath,
        '-frames:v',
        '1',
        '-f',
        'image2pipe',
        '-vcodec',
        'mjpeg',
        '-'
      ],
      { timeout: FRAME_TIMEOUT_MS, maxBuffer: MAX_FRAME_BYTES, encoding: 'buffer' }
    )

    const buf = stdout as Buffer
    return buf.length > 0 ? buf : null
  } catch (err) {
    console.warn(
      '[video] frame extract failed:',
      absolutePath,
      err instanceof Error ? err.message : err
    )
    return null
  }
}

export async function videoThumbnailToJpeg(
  absolutePath: string,
  maxSize: number,
  seekSeconds?: number
): Promise<Buffer | null> {
  const frame = await extractVideoFrameJpeg(absolutePath, seekSeconds)
  if (!frame) return null

  return getSharp()(frame)
    .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer()
}
