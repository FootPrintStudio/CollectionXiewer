import type { Tag, TagExternalLink } from '../../shared/types'
import { formatTagLabel } from '../../shared/tagDisplay'
import { ExternalLinksSection } from './ExternalLinksSection'

interface Props {
  tag: Tag
  links: TagExternalLink[]
  onLinksChange: (next: TagExternalLink[]) => void
}

export function TagExternalLinksSection({ tag, links, onLinksChange }: Props) {
  return (
    <ExternalLinksSection
      entityLabel={formatTagLabel(tag)}
      helpText="Reference URLs for this tag—wiki pages, artist sites, documentation, etc."
      links={links}
      onLinksChange={(next) => onLinksChange(next as TagExternalLink[])}
      onRefreshLinks={() => window.collectionXiewer.tags.externalLinks(tag.id)}
      onAddLink={(label, url) =>
        window.collectionXiewer.tags.addExternalLink(tag.id, label, url).then(() => {})
      }
      onUpdateLink={(id, label, url) =>
        window.collectionXiewer.tags.updateExternalLink(id, label, url).then(() => {})
      }
      onRemoveLink={(id) => window.collectionXiewer.tags.removeExternalLink(id)}
    />
  )
}
