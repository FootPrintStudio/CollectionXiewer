import { create } from 'zustand'

export type ToastKind = 'error' | 'info' | 'success'

export interface Toast {
  id: string
  message: string
  kind: ToastKind
}

let nextId = 0

interface ToastState {
  toasts: Toast[]
  push: (message: string, kind?: ToastKind) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, kind = 'error') => {
    const id = String(++nextId)
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }))
    window.setTimeout(() => {
      useToastStore.getState().dismiss(id)
    }, 6000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))

export function showError(error: unknown): void {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Something went wrong.'
  useToastStore.getState().push(message, 'error')
}

export function showToast(message: string, kind: ToastKind = 'info'): void {
  useToastStore.getState().push(message, kind)
}
