/** App chrome theme preference (Settings → Display). */
export type ThemePreference = 'desktop' | 'light' | 'dark'

export type MintStyle = 'y' | 'l' | 'x' | 'other'
export type MintAppearance = 'light' | 'dark' | 'darker'

export type DesktopThemeColors = {
  accent: string
  bg: string
  surface: string
  base: string
  text: string
  fg: string
  muted: string
  borders: string
  selectedFg: string
  warning: string
  error: string
  success: string
  wmBg: string
}

export type DesktopThemeSnapshot = {
  gtkTheme: string
  /** Theme folder used to resolve colors (may differ from gtkTheme when preference forces light/dark). */
  resolvedTheme: string
  fontName: string
  fontFamily: string
  fontSizePt: number
  colorScheme: 'prefer-dark' | 'prefer-light' | 'default'
  style: MintStyle
  appearance: MintAppearance
  colorName: string | null
  scheme: 'light' | 'dark'
  colors: DesktopThemeColors
}

export type ParsedMintTheme = {
  letter: 'Y' | 'L' | 'X'
  style: MintStyle
  appearance: MintAppearance
  colorName: string | null
}

const MINT_RE = /^Mint-([YLX])(?:-(Darker|Dark))?(?:-([A-Za-z]+))?$/i

export function parseMintThemeName(name: string): ParsedMintTheme | null {
  const m = MINT_RE.exec(name.trim())
  if (!m) return null
  const letter = m[1]!.toUpperCase() as 'Y' | 'L' | 'X'
  const darkPart = m[2]?.toLowerCase()
  const colorName = m[3] ? capitalize(m[3]) : null
  const appearance: MintAppearance =
    darkPart === 'darker' ? 'darker' : darkPart === 'dark' ? 'dark' : 'light'
  const style: MintStyle = letter === 'Y' ? 'y' : letter === 'L' ? 'l' : 'x'
  return { letter, style, appearance, colorName }
}

export function buildMintThemeName(
  parsed: ParsedMintTheme,
  appearance: MintAppearance
): string {
  const style = `Mint-${parsed.letter}`
  const color = parsed.colorName ? `-${parsed.colorName}` : ''
  if (appearance === 'light') return `${style}${color}`
  if (appearance === 'darker') return `${style}-Darker${color}`
  return `${style}-Dark${color}`
}

export function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

/** "Ubuntu 10" / "Ubuntu Bold 11" → family + size. */
export function parseFontName(fontName: string): { family: string; sizePt: number } {
  const trimmed = fontName.trim().replace(/^'|'$/g, '')
  const m = /^(.*)\s+(\d+(?:\.\d+)?)\s*$/.exec(trimmed)
  if (!m) return { family: trimmed || 'sans-serif', sizePt: 10 }
  const rawFamily = m[1]!.trim()
  // Drop weight/style tokens at the end of the family segment (e.g. "Ubuntu Bold")
  const family = rawFamily.replace(/\s+(Thin|Light|Regular|Medium|Semi-?Bold|Bold|Black|Italic|Oblique)$/i, '').trim()
  const sizePt = Number.parseFloat(m[2]!)
  return {
    family: family || 'sans-serif',
    sizePt: Number.isFinite(sizePt) ? sizePt : 10
  }
}

export const FALLBACK_LIGHT_COLORS: DesktopThemeColors = {
  accent: '#35A854',
  bg: '#f8f8f9',
  surface: '#f8f8f9',
  base: '#FFFFFF',
  text: '#303030',
  fg: 'rgba(0, 0, 0, 0.87)',
  muted: '#5c5c5c',
  borders: '#c8c8ce',
  selectedFg: '#FFFFFF',
  warning: '#F27835',
  error: '#FC4138',
  success: '#73D216',
  wmBg: '#e8e8ea'
}

export const FALLBACK_DARK_COLORS: DesktopThemeColors = {
  accent: '#35A854',
  bg: '#2e2e33',
  surface: '#2e2e33',
  base: '#2E2E33',
  text: '#DADADA',
  fg: 'rgba(255, 255, 255, 0.87)',
  muted: '#A7A7AB',
  borders: '#202023',
  selectedFg: '#FFFFFF',
  warning: '#F27835',
  error: '#FC4138',
  success: '#73D216',
  wmBg: '#222226'
}
