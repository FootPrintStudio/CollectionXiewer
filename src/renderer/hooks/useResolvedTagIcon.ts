import { useMemo } from 'react'
import type { Tag } from '../../shared/types'
import { resolveTagIcon } from '../../shared/tagIcon'
import { useAppStore } from '../store/appStore'

export function useResolvedTagIcon(tag: Tag | null | undefined): string | null {
  const tags = useAppStore((s) => s.tags)
  const tagGroups = useAppStore((s) => s.tagGroups)

  return useMemo(() => {
    if (!tag) return null
    const tagsById = new Map(tags.map((t) => [t.id, t]))
    const tagGroupsById = new Map(tagGroups.map((g) => [g.id, g]))
    return resolveTagIcon(tag, tagsById, tagGroupsById)
  }, [tag, tags, tagGroups])
}
