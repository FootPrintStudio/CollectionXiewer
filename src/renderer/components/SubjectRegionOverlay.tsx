import type { CSSProperties } from 'react'
import type { CropRect, Subject } from '../../shared/types'
import { hasSubjectRegion, subjectRegion } from '../../shared/subjects'
import { useSubjectTagDrop } from '../dnd/useSubjectTagDrop'
import { subjectRegionBorderColor } from '../lib/subjectRegionColor'

interface RegionBoxProps {
  mediaId: number
  subject: Subject
  region: CropRect
  interactive: boolean
  highlighted: boolean
}

function SubjectRegionBox({ mediaId, subject, region, interactive, highlighted }: RegionBoxProps) {
  const { setNodeRef, isDropHover } = useSubjectTagDrop(mediaId, subject.id)
  const borderColor = subjectRegionBorderColor(subject.id)

  const style: CSSProperties = {
    left: `${region.x * 100}%`,
    top: `${region.y * 100}%`,
    width: `${region.w * 100}%`,
    height: `${region.h * 100}%`,
    pointerEvents: interactive ? 'auto' : 'none',
    ['--subject-region-color' as string]: borderColor
  }

  return (
    <div
      ref={interactive ? setNodeRef : undefined}
      className={`subject-region${isDropHover ? ' subject-region--drop-hover media-tag-drop-hover' : ''}${highlighted ? ' subject-region--highlight' : ''}`}
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
  visible: boolean
  forceVisible: boolean
  highlightSubjectId?: number | null
}

export function SubjectRegionOverlay({
  mediaId,
  subjects,
  visible,
  forceVisible,
  highlightSubjectId = null
}: Props) {
  const withRegions = subjects.filter(hasSubjectRegion)
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
            interactive={interactive}
            highlighted={highlightSubjectId === subject.id}
          />
        )
      })}
    </div>
  )
}
