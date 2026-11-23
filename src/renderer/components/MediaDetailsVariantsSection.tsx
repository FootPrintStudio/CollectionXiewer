import { useCallback, useEffect, useState } from 'react'
import { Images } from 'lucide-react'
import type { MediaVariantRef } from '../../shared/types'
import { SectionHelp } from '../ui/SectionHelp'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { showError, showToast } from '../store/toastStore'
import { useAppStore } from '../store/appStore'
import { jpegBase64ToObjectUrl, revokeObjectUrl } from '../lib/blobUrl'
import { fetchThumbBase64 } from '../lib/thumbFetch'
import { basenameFromRelativePath } from '../lib/mediaDisplay'

interface Props {
  mediaId: number
  revision: number
  onChanged: () => void
}

function VariantThumb({ mediaId }: { mediaId: number }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    void fetchThumbBase64(mediaId, 96).then((b64) => {
      if (cancelled || !b64) return
      objectUrl = jpegBase64ToObjectUrl(b64)
      setUrl(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) revokeObjectUrl(objectUrl)
    }
  }, [mediaId])

  if (!url) return <div className="media-variant-row__thumb media-variant-row__thumb--empty" />
  return <img className="media-variant-row__thumb" src={url} alt="" />
}

export function MediaDetailsVariantsSection({ mediaId, revision, onChanged }: Props) {
  const selectedMediaIds = useAppStore((s) => s.selectedMediaIds)
  const setSelectedMediaId = useAppStore((s) => s.setSelectedMediaId)
  const openVariantsGallery = useAppStore((s) => s.openVariantsGallery)
  const refreshVariantsMedia = useAppStore((s) => s.refreshVariantsMedia)
  const variantsGalleryAnchorId = useAppStore((s) => s.variantsGalleryAnchorId)
  const [variants, setVariants] = useState<MediaVariantRef[]>([])
  const [busy, setBusy] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState<MediaVariantRef | null>(null)

  const load = useCallback(async () => {
    const list = await window.collectionXiewer.mediaVariants.list(mediaId)
    setVariants(list)
  }, [mediaId])

  useEffect(() => {
    let cancelled = false
    void load().then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [load, revision])

  const otherSelected = selectedMediaIds.filter((id) => id !== mediaId)

  const linkIds = async (ids: number[]) => {
    if (ids.length === 0) return
    setBusy(true)
    try {
      for (const id of ids) {
        await window.collectionXiewer.mediaVariants.link(mediaId, id)
      }
      showToast(
        ids.length === 1 ? 'Variant linked.' : `Linked ${ids.length} variants.`,
        'success'
      )
      onChanged()
      await load()
      if (variantsGalleryAnchorId != null) await refreshVariantsMedia()
    } catch (e) {
      showError(e)
    } finally {
      setBusy(false)
    }
  }

  const addFromSelection = () => {
    void linkIds(otherSelected)
  }

  const addFromFile = async () => {
    setBusy(true)
    try {
      const item = await window.collectionXiewer.media.pickFile()
      if (!item) return
      await window.collectionXiewer.mediaVariants.link(mediaId, item.id)
      showToast('Variant linked.', 'success')
      onChanged()
      await load()
      if (variantsGalleryAnchorId != null) await refreshVariantsMedia()
    } catch (e) {
      showError(e)
    } finally {
      setBusy(false)
    }
  }

  const unlink = async (other: MediaVariantRef) => {
    setBusy(true)
    try {
      await window.collectionXiewer.mediaVariants.unlink(mediaId, other.id)
      setConfirmUnlink(null)
      showToast('Variant removed.', 'success')
      onChanged()
      await load()
      if (variantsGalleryAnchorId != null) await refreshVariantsMedia()
    } catch (e) {
      showError(e)
    } finally {
      setBusy(false)
    }
  }

  const showInGallery = () => {
    void openVariantsGallery(mediaId).catch((e) => showError(e))
  }

  return (
    <section className="media-details-section media-variants-section" aria-label="Media Variants">
      <p className="panel-title">
        Media Variants
        <SectionHelp label="Media Variants help">
          Link alternate files of the same work (crops, formats, edits). Use View in gallery to
          browse the whole group in the center panel. Opening a variant selects it in the library.
        </SectionHelp>
      </p>

      <div className="media-variants-section__actions">
        <button
          type="button"
          className="primary"
          disabled={busy || variants.length === 0}
          title={
            variants.length === 0
              ? 'Link at least one variant to open the variants gallery'
              : 'Show this media and its variants in the center gallery'
          }
          onClick={showInGallery}
        >
          View in gallery
        </button>
        <button
          type="button"
          disabled={busy || otherSelected.length === 0}
          title={
            otherSelected.length === 0
              ? 'Select other gallery items (Ctrl/Cmd-click), then add them as variants'
              : `Link ${otherSelected.length} selected item(s)`
          }
          onClick={addFromSelection}
        >
          Add from selection
          {otherSelected.length > 0 ? ` (${otherSelected.length})` : ''}
        </button>
        <button type="button" disabled={busy} onClick={() => void addFromFile()}>
          Add file…
        </button>
      </div>

      {variants.length === 0 ? (
        <p className="media-variants-section__empty">No variants linked.</p>
      ) : (
        <ul className="media-variants-list">
          {variants.map((v) => (
            <li key={v.id} className="media-variant-row">
              <VariantThumb mediaId={v.id} />
              <div className="media-variant-row__meta">
                <span className="media-variant-row__name" title={v.relative_path}>
                  <Images size={12} aria-hidden className="media-variant-row__icon" />
                  {basenameFromRelativePath(v.relative_path)}
                </span>
                {v.missing ? (
                  <span className="media-variant-row__missing">Missing on disk</span>
                ) : null}
              </div>
              <div className="media-variant-row__buttons">
                <button type="button" disabled={busy} onClick={() => setSelectedMediaId(v.id)}>
                  Open
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={() => setConfirmUnlink(v)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmUnlink ? (
        <ConfirmDialog
          title="Remove variant?"
          message={`Unlink “${basenameFromRelativePath(confirmUnlink.relative_path)}” from this variant group? The file stays in the library.`}
          confirmLabel="Remove"
          danger
          onCancel={() => setConfirmUnlink(null)}
          onConfirm={() => void unlink(confirmUnlink)}
        />
      ) : null}
    </section>
  )
}
