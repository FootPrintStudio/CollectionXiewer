import type { CropRect, Subject } from './types'

export const UNIVERSAL_SUBJECT_LABEL = 'Universal'

export function isUniversalSubjectLabel(label: string): boolean {
  return label.trim().toLowerCase() === UNIVERSAL_SUBJECT_LABEL.toLowerCase()
}

export function subjectRegion(subject: Subject): CropRect | null {
  if (
    subject.region_x == null ||
    subject.region_y == null ||
    subject.region_w == null ||
    subject.region_h == null
  ) {
    return null
  }
  return {
    x: subject.region_x,
    y: subject.region_y,
    w: subject.region_w,
    h: subject.region_h
  }
}

export function hasSubjectRegion(subject: Subject): boolean {
  return subjectRegion(subject) != null
}
