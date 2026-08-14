import { create } from 'zustand'

/**
 * Beginner notification system (spec §74). A small toast queue classified by
 * importance. Callers push a toast; it auto-dismisses. Deliberately minimal so
 * beginners aren't overwhelmed (§74: show only what matters).
 */
export type NotifyKind = 'info' | 'success' | 'warn' | 'error' | 'tip'

export interface Toast {
  id: number
  kind: NotifyKind
  message: string
}

interface NotifyState {
  toasts: Toast[]
  notify: (kind: NotifyKind, message: string, ttlMs?: number) => void
  dismiss: (id: number) => void
}

let seq = 0

export const useNotifyStore = create<NotifyState>((set) => ({
  toasts: [],
  notify: (kind, message, ttlMs = 5000) => {
    const id = ++seq
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }))
    if (ttlMs > 0) {
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ttlMs)
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))

/** Convenience helper for non-React callers. */
export function notify(kind: NotifyKind, message: string): void {
  useNotifyStore.getState().notify(kind, message)
}
