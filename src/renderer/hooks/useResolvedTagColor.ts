import { useMemo } from 'react'
import type { Tag } from '../../shared/types'
import { DEFAULT_TAG_COLOR, resolveTagColor } from '../../shared/tagColor'
import { useAppStore } from '../store/appStore'

export function useResolvedTagColor(tag: Tag | null | undefined): string {
  const tags = useAppStore((s) => s.tags)
  const tagGroups = useAppStore((s) => s.tagGroups)

  return useMemo(() => {
    if (!tag) return DEFAULT_TAG_COLOR
    const tagsById = new Map(tags.map((t) => [t.id, t]))
    const tagGroupsById = new Map(tagGroups.map((g) => [g.id, g]))
    return resolveTagColor(tag, tagsById, tagGroupsById)
  }, [tag, tags, tagGroups])
}

export function useTagColorMaps() {
  const tags = useAppStore((s) => s.tags)
  const tagGroups = useAppStore((s) => s.tagGroups)

  return useMemo(
    () => ({
      tagsById: new Map(tags.map((t) => [t.id, t])),
      tagGroupsById: new Map(tagGroups.map((g) => [g.id, g]))
    }),
    [tags, tagGroups]
  )
}
