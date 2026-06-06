import { useEffect, useRef, useState } from 'react'
import type { CropRect } from '../../shared/types'
import { NormalizedRectEditor } from './NormalizedRectEditor'

interface Props {
  src: string
  mediaId: number
  onCropChange: (rect: CropRect | null) => void
}

export function MarqueeCropEditor({ src, mediaId, onCropChange }: Props) {
  const [initialRect, setInitialRect] = useState<CropRect | null | undefined>(undefined)
  const onCropChangeRef = useRef(onCropChange)
  onCropChangeRef.current = onCropChange

  useEffect(() => {
    let cancelled = false
    void window.collectionXiewer.crop.get(mediaId).then((saved) => {
      if (cancelled) return
      if (saved) {
        const rect = { x: saved.x, y: saved.y, w: saved.w, h: saved.h }
        setInitialRect(rect)
        onCropChangeRef.current(rect)
      } else {
        setInitialRect(null)
        onCropChangeRef.current(null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [mediaId, src])

  if (initialRect === undefined) return null

  return (
    <NormalizedRectEditor
      src={src}
      initialRect={initialRect}
      onRectChange={onCropChange}
      hint="Drag on the image to draw a crop area"
    />
  )
}
