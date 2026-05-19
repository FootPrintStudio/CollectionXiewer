/** Normalize user URL input (add https:// when no scheme). */
export function normalizeExternalUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function validateExternalLink(label: string, url: string): string | null {
  const name = label.trim()
  const href = normalizeExternalUrl(url)
  if (!name) return 'Label is required.'
  if (!href) return 'URL is required.'
  try {
    const parsed = new URL(href)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'Only http and https links are supported.'
    }
  } catch {
    return 'Enter a valid URL.'
  }
  return null
}

export function displayExternalUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.host
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    const tail = `${path}${parsed.search}${parsed.hash}`
    return tail ? `${host}${tail}` : host
  } catch {
    return url
  }
}
