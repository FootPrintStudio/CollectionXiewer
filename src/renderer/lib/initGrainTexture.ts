/** Sets --grain-tile for CSS background layers (no pseudo-elements, no position overrides). */
export function initGrainTexture(): void {
  document.getElementById('cx-grain-injected')?.remove()
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const imageData = ctx.createImageData(size, size)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() + Math.random()) / 2
    const v = Math.round(118 + (n - 0.5) * 50)
    d[i] = v
    d[i + 1] = v
    d[i + 2] = v
    d[i + 3] = Math.round(28 + Math.random() * 32)
  }
  ctx.putImageData(imageData, 0, 0)
  document.documentElement.style.setProperty('--grain-tile', `url("${canvas.toDataURL('image/png')}")`)
}
