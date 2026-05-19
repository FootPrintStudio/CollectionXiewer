/** True when the event target is a text field or CodeMirror — global shortcuts should not steal keys. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  if (target.closest('.cm-editor')) return true
  return false
}
