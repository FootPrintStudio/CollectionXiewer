/** Pick atmosphere FX tier — lite on reduced-motion prefs or low-core CPUs. */
export function initVaultPerformance(): void {
  const root = document.documentElement
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const lowCores =
    typeof navigator.hardwareConcurrency === 'number' &&
    navigator.hardwareConcurrency > 0 &&
    navigator.hardwareConcurrency <= 4

  root.dataset.vaultFx = reducedMotion || lowCores ? 'lite' : 'standard'

  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    if (e.matches) root.dataset.vaultFx = 'lite'
    else if (
      typeof navigator.hardwareConcurrency === 'number' &&
      navigator.hardwareConcurrency > 0 &&
      navigator.hardwareConcurrency <= 4
    ) {
      root.dataset.vaultFx = 'lite'
    } else {
      root.dataset.vaultFx = 'standard'
    }
  })
}
