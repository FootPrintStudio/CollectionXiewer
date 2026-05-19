import type { Tag } from './types'

export function formatTagLabel(tag: Pick<Tag, 'display_name' | 'disambiguator'>): string {
  if (tag.disambiguator) {
    return `${tag.display_name} (${tag.disambiguator})`
  }
  return tag.display_name
}

export function slugifyTag(displayName: string, disambiguator?: string | null): string {
  const base = displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  if (disambiguator) {
    const dis = disambiguator
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    return `${base}--${dis}`
  }
  return base
}
