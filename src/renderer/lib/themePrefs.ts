import type { ThemePreference } from '../../shared/desktopTheme'

const KEY = 'cx-theme-preference'

export function loadThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'desktop' || v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return 'desktop'
}

export function saveThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* ignore */
  }
}
