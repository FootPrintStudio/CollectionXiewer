import { useMemo, useState } from 'react'
import { BookOpen, Pencil } from 'lucide-react'
import type { Tag, TagExternalLink } from '../../shared/types'
import { formatTagLabel } from '../../shared/tagDisplay'
import { displayObsidianLink, isObsidianUrl } from '../../shared/obsidianLinks'
import { ObsidianLinkModal } from '../ui/ObsidianLinkModal'
import { SectionHelp } from '../ui/SectionHelp'
import { showError } from '../store/toastStore'

interface Props {
  tag: Tag
  links: TagExternalLink[]
  onLinksChange: (next: TagExternalLink[]) => void
}

export function TagObsidianLinksSection({ tag, links, onLinksChange }: Props) {
  const obsidianLinks = useMemo(() => links.filter((l) => isObsidianUrl(l.url)), [links])
  const [modalLink, setModalLink] = useState<TagExternalLink | null | undefined>(undefined)

  const refresh = async () => {
    onLinksChange(await window.collectionXiewer.tags.externalLinks(tag.id))
  }

  const remove = async (id: number) => {
    await window.collectionXiewer.tags.removeExternalLink(id)
    onLinksChange(links.filter((l) => l.id !== id))
  }

  const open = (url: string) => {
    void window.collectionXiewer.shell.openExternal(url).catch((e) => showError(e))
  }

  return (
    <section className="tag-external-links-section" aria-label="Obsidian pages">
      <div className="tag-external-links-section__header">
        <p className="panel-title">
          Obsidian pages
          <SectionHelp label="Obsidian pages help">
            Dedicated vault note links for this tag (under External links). Stored as{' '}
            <code>obsidian://open</code> URIs and opened in Obsidian.
          </SectionHelp>
        </p>
        <button
          type="button"
          className="primary tag-external-links-section__add"
          onClick={() => setModalLink(null)}
        >
          + Page
        </button>
      </div>

      {obsidianLinks.length === 0 ? (
        <p className="tag-external-links-section__empty">No Obsidian pages linked yet.</p>
      ) : (
        <ul className="tag-external-links-section__list">
          {obsidianLinks.map((link) => (
            <li key={link.id} className="tag-external-link-row">
              <button
                type="button"
                className="tag-external-link-row__main"
                onClick={() => open(link.url)}
              >
                <span className="tag-external-link-row__label">
                  <BookOpen size={12} aria-hidden className="tag-external-link-row__obsidian-icon" />
                  {link.label}
                </span>
                <span className="tag-external-link-row__url" title={link.url}>
                  {displayObsidianLink(link.url)}
                </span>
              </button>
              <div className="tag-external-link-row__actions">
                <button
                  type="button"
                  className="tag-external-link-row__action"
                  aria-label={`Open ${link.label} in Obsidian`}
                  title="Open in Obsidian"
                  onClick={() => open(link.url)}
                >
                  <BookOpen size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className="tag-external-link-row__action"
                  aria-label={`Edit ${link.label}`}
                  title="Edit link"
                  onClick={() => setModalLink(link)}
                >
                  <Pencil size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className="tag-external-link-row__remove"
                  aria-label={`Remove ${link.label}`}
                  onClick={() => void remove(link.id)}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalLink !== undefined ? (
        <ObsidianLinkModal
          entityLabel={formatTagLabel(tag)}
          link={modalLink}
          onClose={() => setModalLink(undefined)}
          onSave={async (label, url) => {
            if (modalLink) {
              await window.collectionXiewer.tags.updateExternalLink(modalLink.id, label, url)
            } else {
              await window.collectionXiewer.tags.addExternalLink(tag.id, label, url)
            }
            await refresh()
          }}
        />
      ) : null}
    </section>
  )
}
