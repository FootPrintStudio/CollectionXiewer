import { useState } from 'react'
import { ExternalLink, Pencil } from 'lucide-react'
import type { Tag, TagExternalLink } from '../../shared/types'
import { displayExternalUrl } from '../../shared/tagExternalLinks'
import { TagExternalLinkModal } from '../ui/TagExternalLinkModal'
import { SectionHelp } from '../ui/SectionHelp'

function ExternalLinkRow({
  link,
  onOpen,
  onEdit,
  onRemove
}: {
  link: TagExternalLink
  onOpen: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <li className="tag-external-link-row">
      <button type="button" className="tag-external-link-row__main" onClick={onOpen}>
        <span className="tag-external-link-row__label">{link.label}</span>
        <span className="tag-external-link-row__url" title={link.url}>
          {displayExternalUrl(link.url)}
        </span>
      </button>
      <div className="tag-external-link-row__actions">
        <button
          type="button"
          className="tag-external-link-row__action"
          aria-label={`Open ${link.label}`}
          title="Open in browser"
          onClick={onOpen}
        >
          <ExternalLink size={14} aria-hidden />
        </button>
        <button
          type="button"
          className="tag-external-link-row__action"
          aria-label={`Edit ${link.label}`}
          title="Edit link"
          onClick={onEdit}
        >
          <Pencil size={14} aria-hidden />
        </button>
        <button
          type="button"
          className="tag-external-link-row__remove"
          aria-label={`Remove ${link.label}`}
          onClick={onRemove}
        >
          ×
        </button>
      </div>
    </li>
  )
}

interface Props {
  tag: Tag
  links: TagExternalLink[]
  onLinksChange: (next: TagExternalLink[]) => void
}

export function TagExternalLinksSection({ tag, links, onLinksChange }: Props) {
  const [modalLink, setModalLink] = useState<TagExternalLink | null | undefined>(undefined)

  const refresh = async () => {
    onLinksChange(await window.collectionXiewer.tags.externalLinks(tag.id))
  }

  const remove = async (id: number) => {
    await window.collectionXiewer.tags.removeExternalLink(id)
    onLinksChange(links.filter((l) => l.id !== id))
  }

  const open = (url: string) => {
    void window.collectionXiewer.shell.openExternal(url)
  }

  return (
    <section className="tag-external-links-section" aria-label="External links">
      <div className="tag-external-links-section__header">
        <p className="panel-title">
          External links
          <SectionHelp label="External links help">
            Reference URLs for this tag—wiki pages, artist sites, documentation, etc.
          </SectionHelp>
        </p>
        <button
          type="button"
          className="primary tag-external-links-section__add"
          onClick={() => setModalLink(null)}
        >
          + Link
        </button>
      </div>

      {links.length === 0 ? (
        <p className="tag-external-links-section__empty">No external links yet.</p>
      ) : (
        <ul className="tag-external-links-section__list">
          {links.map((link) => (
            <ExternalLinkRow
              key={link.id}
              link={link}
              onOpen={() => open(link.url)}
              onEdit={() => setModalLink(link)}
              onRemove={() => void remove(link.id)}
            />
          ))}
        </ul>
      )}

      {modalLink !== undefined ? (
        <TagExternalLinkModal
          tag={tag}
          link={modalLink}
          onClose={() => setModalLink(undefined)}
          onSaved={() => void refresh()}
        />
      ) : null}
    </section>
  )
}
