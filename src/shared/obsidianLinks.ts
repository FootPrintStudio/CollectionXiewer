/** Build / parse Obsidian URI links for tag → vault note navigation. */

export type ObsidianOpenTarget = {
  vault: string
  file: string
}

/** `obsidian://open?vault=Name&file=path/to/Note` (file may be URL-encoded). */
export function buildObsidianOpenUrl(vault: string, file: string): string {
  const v = vault.trim()
  const f = file.trim().replace(/\\/g, '/')
  const params = new URLSearchParams()
  if (v) params.set('vault', v)
  params.set('file', f)
  return `obsidian://open?${params.toString()}`
}

export function isObsidianUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'obsidian:'
  } catch {
    return url.trim().toLowerCase().startsWith('obsidian:')
  }
}

export function parseObsidianOpenUrl(url: string): ObsidianOpenTarget | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'obsidian:') return null
    // Host may be "open"; query holds vault/file.
    const vault = parsed.searchParams.get('vault') ?? ''
    const file = parsed.searchParams.get('file') ?? ''
    if (!file.trim()) return null
    return { vault: vault.trim(), file: file.trim() }
  } catch {
    return null
  }
}

export function validateObsidianLink(label: string, vault: string, file: string): string | null {
  if (!label.trim()) return 'Label is required.'
  if (!file.trim()) return 'Note path is required.'
  return null
}

export function displayObsidianLink(url: string): string {
  const target = parseObsidianOpenUrl(url)
  if (!target) return url
  if (target.vault) return `${target.vault} · ${target.file}`
  return target.file
}

const VAULT_PREF_KEY = 'cx-obsidian-default-vault'

export function loadDefaultObsidianVault(): string {
  try {
    return localStorage.getItem(VAULT_PREF_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveDefaultObsidianVault(vault: string): void {
  try {
    const trimmed = vault.trim()
    if (trimmed) localStorage.setItem(VAULT_PREF_KEY, trimmed)
    else localStorage.removeItem(VAULT_PREF_KEY)
  } catch {
    /* ignore */
  }
}
