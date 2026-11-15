import type { DesktopThemeSnapshot, ThemePreference } from '../../shared/desktopTheme'
import { loadThemePreference, saveThemePreference } from './themePrefs'

let currentPreference: ThemePreference = loadThemePreference()
let unsubDesktop: (() => void) | null = null
let applying = false

function contrastTextOnAccent(accent: string): string {
  // Prefer white on Mint accents; fall back if accent parses as very light.
  const hex = /^#([0-9a-f]{6})$/i.exec(accent.trim())
  if (!hex) return '#ffffff'
  const n = Number.parseInt(hex[1]!, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luma > 0.65 ? '#202020' : '#ffffff'
}

export function applyDesktopThemeSnapshot(snap: DesktopThemeSnapshot): void {
  const root = document.documentElement
  const c = snap.colors

  root.dataset.theme = 'mint'
  root.dataset.scheme = snap.scheme
  root.dataset.mintStyle = snap.style
  root.dataset.mintAppearance = snap.appearance
  if (snap.colorName) root.dataset.mintColor = snap.colorName
  else delete root.dataset.mintColor

  root.style.colorScheme = snap.scheme

  const accentText = contrastTextOnAccent(c.accent)
  const fontStack = `"${snap.fontFamily}", "Ubuntu", Cantarell, "Noto Sans", "DejaVu Sans", sans-serif`

  const vars: Record<string, string> = {
    '--font-display': fontStack,
    '--font-serif': fontStack,
    '--font-sans': fontStack,
    '--font-mono': 'ui-monospace, "Ubuntu Mono", "Liberation Mono", Menlo, monospace',
    '--font-ui-size': `${snap.fontSizePt}pt`,

    '--color-bg': c.bg,
    '--color-bg-subtle': c.wmBg,
    '--color-surface': c.surface,
    '--color-surface-raised': c.base,
    '--color-surface-overlay': c.base,

    '--color-text': c.text,
    '--color-text-muted': c.muted,
    '--color-text-subtle': c.muted,
    '--color-text-inverse': accentText,

    '--color-border': c.borders,
    '--color-border-strong': c.borders,
    '--color-border-focus': c.accent,

    '--color-accent': c.accent,
    '--color-accent-hover': c.accent,
    '--color-accent-subtle': `color-mix(in srgb, ${c.accent} 18%, transparent)`,
    '--color-accent-text': accentText,
    '--color-accent-gold': c.accent,
    '--color-accent-pale': `color-mix(in srgb, ${c.accent} 35%, ${c.base})`,
    '--color-accent-deep': c.accent,
    '--color-accent-ember': c.accent,

    '--color-success': c.success,
    '--color-warning': c.warning,
    '--color-error': c.error,

    '--color-link': c.accent,
    '--color-link-hover': c.accent,

    '--bg': c.bg,
    '--bg-elevated': c.base,
    '--bg-panel': c.surface,
    '--surface': c.surface,
    '--border': c.borders,
    '--border-dashed': c.borders,
    '--border-strong': c.borders,
    '--text': c.text,
    '--text-muted': c.muted,
    '--text-subtle': c.muted,
    '--muted': c.muted,
    '--accent': c.accent,
    '--accent-hover': c.accent,
    '--accent-muted': `color-mix(in srgb, ${c.accent} 18%, transparent)`,
    '--accent-text': accentText,
    '--accent-spark': c.accent,
    '--chip-bg': c.base,
    '--soft-chip': c.surface,
    '--danger': c.error,
    '--success': c.success,
    '--warning': c.warning,

    '--shadow-sm': snap.scheme === 'light' ? '0 1px 2px rgb(0 0 0 / 0.12)' : '0 1px 3px rgb(0 0 0 / 0.45)',
    '--shadow-md': snap.scheme === 'light' ? '0 4px 12px rgb(0 0 0 / 0.14)' : '0 6px 18px rgb(0 0 0 / 0.5)',
    '--shadow': 'var(--shadow-sm)',
    '--shadow-card': 'none',
    '--shadow-dropdown': 'var(--shadow-md)',
    '--vault-glow-soft': 'none',
    '--vault-glow-amber': 'none',
    '--vault-glow-text': 'none',
    '--vault-glow-inner': 'none',
    '--vault-glow-focus': `0 0 0 2px color-mix(in srgb, ${c.accent} 45%, transparent)`
  }

  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v)
  }
}

export async function refreshAppTheme(): Promise<void> {
  if (applying) return
  applying = true
  try {
    const snap = await window.collectionXiewer.desktopTheme.get(currentPreference)
    applyDesktopThemeSnapshot(snap)
  } catch (err) {
    console.warn('[theme] refresh failed:', err)
  } finally {
    applying = false
  }
}

export function getThemePreference(): ThemePreference {
  return currentPreference
}

export async function setThemePreference(pref: ThemePreference): Promise<void> {
  currentPreference = pref
  saveThemePreference(pref)
  await refreshAppTheme()
}

/** Boot theme + subscribe to desktop theme changes (Desktop mode). */
export function initAppTheme(): void {
  currentPreference = loadThemePreference()
  void refreshAppTheme()
  unsubDesktop?.()
  unsubDesktop = window.collectionXiewer.desktopTheme.onChanged(() => {
    void refreshAppTheme()
  })
}
