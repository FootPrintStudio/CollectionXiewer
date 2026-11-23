import { Images } from 'lucide-react'
import { useAppStore } from '../store/appStore'

export function VariantsGalleryBanner() {
  const variantsGalleryAnchorId = useAppStore((s) => s.variantsGalleryAnchorId)
  const variantsMedia = useAppStore((s) => s.variantsMedia)
  const closeVariantsGallery = useAppStore((s) => s.closeVariantsGallery)

  if (variantsGalleryAnchorId == null) return null

  const count = variantsMedia.length

  return (
    <div className="variants-gallery-banner" role="status">
      <Images size={16} aria-hidden className="variants-gallery-banner__icon" />
      <span className="variants-gallery-banner__text">
        Media Variants gallery
        <span className="variants-gallery-banner__count">
          {count} item{count === 1 ? '' : 's'}
        </span>
      </span>
      <button type="button" className="variants-gallery-banner__exit" onClick={closeVariantsGallery}>
        Back to library
      </button>
    </div>
  )
}
