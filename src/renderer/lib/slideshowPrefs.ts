const INTERVAL_KEY = 'cx-slideshow-interval-sec'

export function loadSlideshowIntervalSec(): number {
  try {
    const v = Number(localStorage.getItem(INTERVAL_KEY))
    if (v === 3 || v === 5 || v === 10) return v
  } catch {
    /* ignore */
  }
  return 5
}

export function saveSlideshowIntervalSec(sec: number): void {
  try {
    localStorage.setItem(INTERVAL_KEY, String(sec))
  } catch {
    /* ignore */
  }
}
