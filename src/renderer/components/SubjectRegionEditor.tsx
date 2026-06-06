import { useState } from 'react'
import type { CropRect } from '../../shared/types'
import { NormalizedRectEditor } from './NormalizedRectEditor'

interface Props {
  src: string
  subjectLabel: string
  initialRect: CropRect | null
  onRectChange: (rect: CropRect | null) => void
}

export function SubjectRegionEditor({ src, subjectLabel, initialRect, onRectChange }: Props) {
  const [rect, setRect] = useState<CropRect | null>(initialRect)

  const handleChange = (next: CropRect | null) => {
    setRect(next)
    onRectChange(next)
  }

  return (
    <div className="subject-region-editor">
      <NormalizedRectEditor
        src={src}
        initialRect={initialRect}
        onRectChange={handleChange}
        hint={`Drag on the image to define a region for “${subjectLabel}”`}
        className="marquee-crop subject-region-editor__canvas"
      />
      {!rect ? (
        <p className="subject-region-editor__status">No region drawn yet.</p>
      ) : null}
    </div>
  )
}
