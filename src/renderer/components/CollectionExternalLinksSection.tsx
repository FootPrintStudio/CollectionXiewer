import type { Collection, CollectionExternalLink } from '../../shared/types'
import { ExternalLinksSection } from './ExternalLinksSection'

interface Props {
  collection: Collection
  links: CollectionExternalLink[]
  onLinksChange: (next: CollectionExternalLink[]) => void
}

export function CollectionExternalLinksSection({ collection, links, onLinksChange }: Props) {
  return (
    <ExternalLinksSection
      entityLabel={collection.name}
      helpText="Reference URLs for this collection—source albums, project pages, documentation, etc."
      links={links}
      onLinksChange={(next) => onLinksChange(next as CollectionExternalLink[])}
      onRefreshLinks={() => window.collectionXiewer.collections.externalLinks(collection.id)}
      onAddLink={(label, url) =>
        window.collectionXiewer.collections
          .addExternalLink(collection.id, label, url)
          .then(() => {})
      }
      onUpdateLink={(id, label, url) =>
        window.collectionXiewer.collections.updateExternalLink(id, label, url).then(() => {})
      }
      onRemoveLink={(id) => window.collectionXiewer.collections.removeExternalLink(id)}
    />
  )
}
