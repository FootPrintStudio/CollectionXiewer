import type { TagConnection } from './types'

export type TagConnectionKind = TagConnection['kind']

export const TAG_CONNECTION_KINDS: TagConnectionKind[] = ['hard', 'soft']

export const TAG_CONNECTION_KIND_META: Record<
  TagConnectionKind,
  { label: string; badge: string; description: string }
> = {
  hard: {
    label: 'Hard connection',
    badge: 'Auto-apply',
    description:
      'When this tag is applied to media, connected tags are added automatically in the same subject.'
  },
  soft: {
    label: 'Soft connection',
    badge: 'Suggest',
    description:
      'Related tags shown as suggestions when this tag is applied—they are never added automatically.'
  }
}

export function validateTagConnection(
  sourceTagId: number,
  targetTagId: number,
  kind: TagConnectionKind,
  existing: TagConnection[]
): string | null {
  if (targetTagId === sourceTagId) {
    return 'A tag cannot connect to itself.'
  }
  if (existing.some((c) => c.target_tag_id === targetTagId && c.kind === kind)) {
    return `This tag already has a ${kind} connection to that target.`
  }
  return null
}
