export type UpdaterPhase =
  | 'idle'
  | 'unavailable'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdaterStatus {
  phase: UpdaterPhase
  currentVersion: string
  version?: string
  percent?: number
  message?: string
}

export const GITHUB_RELEASES_URL =
  'https://github.com/FootPrintStudio/CollectionXiewer/releases'
