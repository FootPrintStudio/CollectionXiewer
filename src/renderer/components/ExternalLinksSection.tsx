import { useState } from 'react'
import { ExternalLink, Pencil } from 'lucide-react'
import { displayExternalUrl } from '../../shared/tagExternalLinks'
import { ExternalLinkModal, type ExternalLinkRecord } from '../ui/ExternalLinkModal'
import { SectionHelp } from '../ui/SectionHelp'

function ExternalLinkRow({
  link,
  onOpen,
  onEdit,
  onRemove
}: {
  link: ExternalLinkRecord
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
  entityLabel: string
  helpText: string
  links: ExternalLinkRecord[]
  onLinksChange: (next: ExternalLinkRecord[]) => void
  onAddLink: (label: string, url: string) => Promise<void>
  onUpdateLink: (id: number, label: string, url: string) => Promise<void>
  onRemoveLink: (id: number) => Promise<void>
  onRefreshLinks: () => Promise<ExternalLinkRecord[]>
}

export function ExternalLinksSection({
  entityLabel,
  helpText,
  links,
  onLinksChange,
  onAddLink,
  onUpdateLink,
  onRemoveLink,
  onRefreshLinks
}: Props) {
  const [modalLink, setModalLink] = useState<ExternalLinkRecord | null | undefined>(undefined)

  const refresh = async () => {
    onLinksChange(await onRefreshLinks())
  }

  const remove = async (id: number) => {
    await onRemoveLink(id)
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
          <SectionHelp label="External links help">{helpText}</SectionHelp>
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
        <ExternalLinkModal
          entityLabel={entityLabel}
          link={modalLink}
          onClose={() => setModalLink(undefined)}
          onSave={async (label, url) => {
            if (modalLink) {
              await onUpdateLink(modalLink.id, label, url)
            } else {
              await onAddLink(label, url)
            }
            await refresh()
          }}
        />
      ) : null}
    </section>
  )
}
