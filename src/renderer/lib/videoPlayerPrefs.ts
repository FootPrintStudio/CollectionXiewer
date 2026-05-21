const VOLUME_KEY = 'collectionXiewer.videoVolume'
const MUTED_KEY = 'collectionXiewer.videoMuted'
const LOOP_KEY = 'collectionXiewer.videoLoop'

export function loadVideoVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    if (raw == null) return 1
    const n = Number(raw)
    if (!Number.isFinite(n)) return 1
    return Math.min(1, Math.max(0, n))
  } catch {
    return 1
  }
}

export function saveVideoVolume(volume: number): void {
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.min(1, Math.max(0, volume))))
  } catch {
    /* ignore */
  }
}

export function loadVideoMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1'
  } catch {
    return false
  }
}

export function saveVideoMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, muted ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function loadVideoLoop(): boolean {
  try {
    return localStorage.getItem(LOOP_KEY) === '1'
  } catch {
    return false
  }
}

export function saveVideoLoop(loop: boolean): void {
  try {
    localStorage.setItem(LOOP_KEY, loop ? '1' : '0')
  } catch {
    /* ignore */
  }
}
