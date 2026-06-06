import type { CSSProperties } from 'react'
import type { CropRect, Subject } from '../../shared/types'
import { hasSubjectRegion, subjectRegion } from '../../shared/subjects'
import type { PreviewImageGeometry } from '../lib/previewImageGeometry'
import { usePreviewSubjectDrop } from '../dnd/usePreviewSubjectDrop'
import { subjectRegionBorderColor } from '../lib/subjectRegionColor'

interface RegionBoxProps {
  mediaId: number
  subject: Subject
  region: CropRect
  geometry: PreviewImageGeometry
  interactive: boolean
  highlighted: boolean
}

function regionPixelRect(region: CropRect, geometry: PreviewImageGeometry) {
  const { x, y, w, h } = geometry.imageRect
  return {
    left: x + region.x * w,
    top: y + region.y * h,
    width: region.w * w,
    height: region.h * h
  }
}

function SubjectRegionBox({
  mediaId,
  subject,
  region,
  geometry,
  interactive,
  highlighted
}: RegionBoxProps) {
  const { setNodeRef, isDropHover } = usePreviewSubjectDrop(mediaId, subject.id)
  const borderColor = subjectRegionBorderColor(subject.id)
  const px = regionPixelRect(region, geometry)

  const style: CSSProperties = {
    left: px.left,
    top: px.top,
    width: px.width,
    height: px.height,
    ['--subject-region-color' as string]: borderColor
  }

  return (
    <div
      ref={setNodeRef}
      className={`subject-region${interactive && isDropHover ? ' subject-region--drop-hover media-tag-drop-hover' : ''}${highlighted ? ' subject-region--highlight' : ''}${!interactive ? ' subject-region--passive' : ''}`}
      style={style}
      title={subject.label}
    >
      <span className="subject-region__label">{subject.label}</span>
    </div>
  )
}

interface Props {
  mediaId: number
  subjects: Subject[]
  geometry: PreviewImageGeometry
  visible: boolean
  forceVisible: boolean
  highlightSubjectId?: number | null
}

export function SubjectRegionOverlay({
  mediaId,
  subjects,
  geometry,
  visible,
  forceVisible,
  highlightSubjectId = null
}: Props) {
  const withRegions = subjects.filter(
    (s) => s.media_id === mediaId && hasSubjectRegion(s)
  )
  if (withRegions.length === 0) return null

  const show = visible || forceVisible
  const interactive = forceVisible

  return (
    <div
      className={`subject-region-layer${show ? '' : ' subject-region-layer--hidden'}`}
      aria-hidden={!show}
    >
      {withRegions.map((subject) => {
        const region = subjectRegion(subject)!
        return (
          <SubjectRegionBox
            key={subject.id}
            mediaId={mediaId}
            subject={subject}
            region={region}
            geometry={geometry}
            interactive={interactive}
            highlighted={highlightSubjectId === subject.id}
          />
        )
      })}
    </div>
  )
}
