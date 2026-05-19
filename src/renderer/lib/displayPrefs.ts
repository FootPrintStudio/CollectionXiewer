const KEY_THUMB_TAGS = 'cx-show-thumb-tag-list'
const KEY_IDENTIFIERS = 'cx-show-identifiers'

export function loadShowThumbTagList(): boolean {
  try {
    return localStorage.getItem(KEY_THUMB_TAGS) === '1'
  } catch {
    return false
  }
}

export function saveShowThumbTagList(on: boolean): void {
  try {
    localStorage.setItem(KEY_THUMB_TAGS, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function loadShowIdentifiers(): boolean {
  try {
    return localStorage.getItem(KEY_IDENTIFIERS) === '1'
  } catch {
    return false
  }
}

export function saveShowIdentifiers(on: boolean): void {
  try {
    localStorage.setItem(KEY_IDENTIFIERS, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}
