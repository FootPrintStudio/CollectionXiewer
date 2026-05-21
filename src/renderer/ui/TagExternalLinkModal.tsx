import type { Tag, TagExternalLink } from '../../shared/types'
import { formatTagLabel } from '../../shared/tagDisplay'
import { ExternalLinkModal } from './ExternalLinkModal'

export interface TagExternalLinkModalProps {
  tag: Tag
  link?: TagExternalLink | null
  onClose: () => void
  onSaved: () => void
}

/** @deprecated Use ExternalLinkModal via ExternalLinksSection */
export function TagExternalLinkModal({ tag, link, onClose, onSaved }: TagExternalLinkModalProps) {
  return (
    <ExternalLinkModal
      entityLabel={formatTagLabel(tag)}
      link={link ?? undefined}
      onClose={onClose}
      onSave={async (label, url) => {
        if (link) {
          await window.collectionXiewer.tags.updateExternalLink(link.id, label, url)
        } else {
          await window.collectionXiewer.tags.addExternalLink(tag.id, label, url)
        }
        onSaved()
      }}
    />
  )
}
