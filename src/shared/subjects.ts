export const UNIVERSAL_SUBJECT_LABEL = 'Universal'

export function isUniversalSubjectLabel(label: string): boolean {
  return label.trim().toLowerCase() === UNIVERSAL_SUBJECT_LABEL.toLowerCase()
}
