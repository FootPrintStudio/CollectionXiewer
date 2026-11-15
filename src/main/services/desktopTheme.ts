import { spawn, type ChildProcess, execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { BrowserWindow } from 'electron'
import {
  buildMintThemeName,
  FALLBACK_DARK_COLORS,
  FALLBACK_LIGHT_COLORS,
  parseFontName,
  parseMintThemeName,
  type DesktopThemeColors,
  type DesktopThemeSnapshot,
  type MintAppearance,
  type ThemePreference
} from '../../shared/desktopTheme'

let mainWindow: BrowserWindow | null = null
let monitors: ChildProcess[] = []
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function gsettingsGet(schema: string, key: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('gsettings', ['get', schema, key], { timeout: 3000 }, (err, stdout) => {
      if (err) {
        resolve(null)
        return
      }
      const raw = stdout.trim()
      // gsettings prints strings as 'value' or just enums
      if (raw.startsWith("'") && raw.endsWith("'")) {
        resolve(raw.slice(1, -1))
        return
      }
      resolve(raw || null)
    })
  })
}

function themeCssPath(themeName: string): string | null {
  const candidates = [
    join(homedir(), '.themes', themeName, 'gtk-3.0', 'gtk.css'),
    join('/usr/share/themes', themeName, 'gtk-3.0', 'gtk.css'),
    join('/usr/local/share/themes', themeName, 'gtk-3.0', 'gtk.css')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

function parseDefineColors(css: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /@define-color\s+([a-zA-Z0-9_]+)\s+([^;]+);/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    out[m[1]!] = m[2]!.trim()
  }
  return out
}

function pickColor(
  defs: Record<string, string>,
  keys: string[],
  fallback: string
): string {
  for (const k of keys) {
    const v = defs[k]
    if (v) return v
  }
  return fallback
}

function colorsFromDefs(
  defs: Record<string, string>,
  scheme: 'light' | 'dark'
): DesktopThemeColors {
  const base = scheme === 'light' ? FALLBACK_LIGHT_COLORS : FALLBACK_DARK_COLORS
  const accent = pickColor(defs, ['accent_color', 'selected_bg_color', 'theme_selected_bg_color'], base.accent)
  const bg = pickColor(defs, ['theme_bg_color', 'bg_color'], base.bg)
  const surface = pickColor(defs, ['theme_bg_color', 'bg_color'], base.surface)
  const baseColor = pickColor(defs, ['theme_base_color', 'base_color', 'content_view_bg'], base.base)
  const text = pickColor(defs, ['theme_text_color', 'text_color'], base.text)
  const fg = pickColor(defs, ['theme_fg_color', 'fg_color'], base.fg)
  const borders = pickColor(defs, ['borders', 'unfocused_borders'], base.borders)
  const selectedFg = pickColor(defs, ['theme_selected_fg_color', 'selected_fg_color'], base.selectedFg)
  const warning = pickColor(defs, ['warning_color'], base.warning)
  const error = pickColor(defs, ['error_color'], base.error)
  const success = pickColor(defs, ['success_color'], base.success)
  const wmBg = pickColor(defs, ['wm_bg', 'theme_bg_color'], base.wmBg)
  const muted = pickColor(defs, ['wm_title_unfocused', 'placeholder_text_color', 'insensitive_fg_color'], base.muted)
  return {
    accent,
    bg,
    surface,
    base: baseColor,
    text,
    fg,
    muted,
    borders,
    selectedFg,
    warning,
    error,
    success,
    wmBg
  }
}

function resolveThemeName(
  gtkTheme: string,
  preference: ThemePreference,
  colorScheme: DesktopThemeSnapshot['colorScheme']
): { resolvedTheme: string; scheme: 'light' | 'dark'; appearance: MintAppearance; style: DesktopThemeSnapshot['style']; colorName: string | null } {
  const parsed = parseMintThemeName(gtkTheme)

  if (preference === 'light') {
    if (parsed) {
      return {
        resolvedTheme: buildMintThemeName(parsed, 'light'),
        scheme: 'light',
        appearance: 'light',
        style: parsed.style,
        colorName: parsed.colorName
      }
    }
    return {
      resolvedTheme: gtkTheme,
      scheme: 'light',
      appearance: 'light',
      style: 'other',
      colorName: null
    }
  }

  if (preference === 'dark') {
    if (parsed) {
      const appearance: MintAppearance = parsed.appearance === 'darker' ? 'darker' : 'dark'
      return {
        resolvedTheme: buildMintThemeName(parsed, appearance),
        scheme: 'dark',
        appearance,
        style: parsed.style,
        colorName: parsed.colorName
      }
    }
    return {
      resolvedTheme: gtkTheme,
      scheme: 'dark',
      appearance: 'dark',
      style: 'other',
      colorName: null
    }
  }

  // Desktop — gtk-theme is Mint Themes (Style / Appearance / Color) source of truth
  if (parsed) {
    return {
      resolvedTheme: gtkTheme,
      scheme: parsed.appearance === 'light' ? 'light' : 'dark',
      appearance: parsed.appearance,
      style: parsed.style,
      colorName: parsed.colorName
    }
  }

  const scheme: 'light' | 'dark' =
    colorScheme === 'prefer-light'
      ? 'light'
      : colorScheme === 'prefer-dark'
        ? 'dark'
        : /dark/i.test(gtkTheme)
          ? 'dark'
          : 'light'
  return {
    resolvedTheme: gtkTheme,
    scheme,
    appearance: scheme === 'light' ? 'light' : 'dark',
    style: 'other',
    colorName: null
  }
}

function normalizeColorScheme(raw: string | null): DesktopThemeSnapshot['colorScheme'] {
  if (raw === 'prefer-dark' || raw === 'prefer-light' || raw === 'default') return raw
  return 'default'
}

export async function readDesktopTheme(
  preference: ThemePreference = 'desktop'
): Promise<DesktopThemeSnapshot> {
  const [gtkThemeRaw, fontNameRaw, colorSchemeRaw, accentRgb] = await Promise.all([
    gsettingsGet('org.cinnamon.desktop.interface', 'gtk-theme'),
    gsettingsGet('org.cinnamon.desktop.interface', 'font-name'),
    gsettingsGet('org.x.apps.portal', 'color-scheme'),
    gsettingsGet('org.x.apps.portal', 'accent-rgb')
  ])

  const gtkTheme = gtkThemeRaw || 'Mint-Y'
  const fontName = fontNameRaw || 'Ubuntu 10'
  const { family, sizePt } = parseFontName(fontName)
  const colorScheme = normalizeColorScheme(colorSchemeRaw)

  const resolved = resolveThemeName(gtkTheme, preference, colorScheme)
  const cssPath = themeCssPath(resolved.resolvedTheme)
  let colors =
    resolved.scheme === 'light' ? { ...FALLBACK_LIGHT_COLORS } : { ...FALLBACK_DARK_COLORS }

  if (cssPath) {
    try {
      const css = readFileSync(cssPath, 'utf8')
      // Prefer trailing define-color block (compiled themes append them)
      const defs = parseDefineColors(css)
      colors = colorsFromDefs(defs, resolved.scheme)
    } catch (err) {
      console.warn(
        '[desktopTheme] failed to read theme CSS:',
        err instanceof Error ? err.message : err
      )
    }
  }

  // Optional portal accent override (r,g,b)
  if (accentRgb && accentRgb.trim()) {
    const m = /^\(?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)?$/.exec(accentRgb.trim())
    if (m) {
      colors = {
        ...colors,
        accent: `rgb(${m[1]}, ${m[2]}, ${m[3]})`
      }
    }
  }

  return {
    gtkTheme,
    resolvedTheme: resolved.resolvedTheme,
    fontName,
    fontFamily: family,
    fontSizePt: sizePt,
    colorScheme,
    style: resolved.style,
    appearance: resolved.appearance,
    colorName: resolved.colorName,
    scheme: resolved.scheme,
    colors
  }
}

function broadcastTheme(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  // Renderer re-fetches with its stored preference via IPC; still notify so it refreshes.
  mainWindow.webContents.send('desktop-theme:changed')
}

function scheduleBroadcast(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    broadcastTheme()
  }, 120)
}

function startMonitor(schema: string, key: string): void {
  try {
    const child = spawn('gsettings', ['monitor', schema, key], {
      stdio: ['ignore', 'pipe', 'ignore']
    })
    child.stdout?.on('data', () => scheduleBroadcast())
    child.on('error', () => {
      /* gsettings missing — ignore */
    })
    monitors.push(child)
  } catch {
    /* ignore */
  }
}

export function setDesktopThemeMainWindow(win: BrowserWindow | null): void {
  mainWindow = win
}

export function startDesktopThemeMonitor(): void {
  stopDesktopThemeMonitor()
  if (process.platform !== 'linux') return
  startMonitor('org.cinnamon.desktop.interface', 'gtk-theme')
  startMonitor('org.cinnamon.desktop.interface', 'font-name')
  startMonitor('org.x.apps.portal', 'color-scheme')
  startMonitor('org.x.apps.portal', 'accent-rgb')
}

export function stopDesktopThemeMonitor(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  for (const child of monitors) {
    try {
      child.kill()
    } catch {
      /* ignore */
    }
  }
  monitors = []
}
