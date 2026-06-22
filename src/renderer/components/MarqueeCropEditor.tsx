import type { CropRect } from '../../shared/types'
import { NormalizedRectEditor } from './NormalizedRectEditor'

interface Props {
  src: string
  onCropChange: (rect: CropRect | null) => void
}

export function MarqueeCropEditor({ src, onCropChange }: Props) {
  return (
    <NormalizedRectEditor
      src={src}
      initialRect={null}
      onRectChange={onCropChange}
      hint="Drag on the image to draw a crop area"
    />
  )
}
