import type { RefObject } from 'react'
import type { SearchAutocompleteHandle } from '../components/SearchAutocomplete'

/** Handle arrow/enter/tab for search autocomplete; returns true if the event was consumed. */
export function handleSearchAutocompleteKeyDown(
  e: React.KeyboardEvent,
  autocompleteRef: RefObject<SearchAutocompleteHandle | null>
): boolean {
  const ac = autocompleteRef.current
  if (!ac?.isOpen) return false

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    ac.navigate('down')
    return true
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    ac.navigate('up')
    return true
  }
  if (e.key === 'Enter' || e.key === 'Tab') {
    if (ac.pickHighlighted()) {
      e.preventDefault()
      return true
    }
  }
  return false
}
