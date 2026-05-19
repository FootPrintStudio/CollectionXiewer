export const BOARD_DROP_ID = 'board-canvas-drop'

export function isBoardDropId(id: string | number): boolean {
  return String(id) === BOARD_DROP_ID
}
