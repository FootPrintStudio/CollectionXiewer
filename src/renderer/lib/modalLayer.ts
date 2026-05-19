/** Root element for portaled modals that must sit above the settings dropdown. */
export const IDENTIFIER_EDITOR_LAYER = 'identifier-editor'

export function isIdentifierEditorLayerNode(node: Node | null): boolean {
  if (!node) return false
  const el = node instanceof Element ? node : node.parentElement
  return !!el?.closest(`[data-modal-layer="${IDENTIFIER_EDITOR_LAYER}"]`)
}
