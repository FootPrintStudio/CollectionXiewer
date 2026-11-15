import { useMemo } from 'react'
import type { Tag, TagExternalLink } from '../../shared/types'
import { formatTagLabel } from '../../shared/tagDisplay'
import { isObsidianUrl } from '../../shared/obsidianLinks'
import { ExternalLinksSection } from './ExternalLinksSection'
import { TagObsidianLinksSection } from './TagObsidianLinksSection'

interface Props {
  tag: Tag
  links: TagExternalLink[]
  onLinksChange: (next: TagExternalLink[]) => void
}

export function TagExternalLinksSection({ tag, links, onLinksChange }: Props) {
  const webLinks = useMemo(() => links.filter((l) => !isObsidianUrl(l.url)), [links])

  return (
    <>
      <ExternalLinksSection
        entityLabel={formatTagLabel(tag)}
        helpText="Reference http(s) URLs for this tag—artist sites, documentation, etc."
        links={webLinks}
        onLinksChange={() => {
          void window.collectionXiewer.tags.externalLinks(tag.id).then(onLinksChange)
        }}
        onRefreshLinks={() => window.collectionXiewer.tags.externalLinks(tag.id)}
        onAddLink={(label, url) =>
          window.collectionXiewer.tags.addExternalLink(tag.id, label, url).then(() => {})
        }
        onUpdateLink={(id, label, url) =>
          window.collectionXiewer.tags.updateExternalLink(id, label, url).then(() => {})
        }
        onRemoveLink={(id) => window.collectionXiewer.tags.removeExternalLink(id)}
      />
      <TagObsidianLinksSection tag={tag} links={links} onLinksChange={onLinksChange} />
    </>
  )
}
