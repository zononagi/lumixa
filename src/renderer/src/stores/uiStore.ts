import { create } from 'zustand'

/** Cross-cutting UI visibility state (bottom terminal panel, Composer modal). */
interface UiState {
  terminalOpen: boolean
  composerOpen: boolean
  toggleTerminal: () => void
  setTerminal: (open: boolean) => void
  toggleComposer: () => void
  setComposer: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  terminalOpen: false,
  composerOpen: false,
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  setTerminal: (open) => set({ terminalOpen: open }),
  toggleComposer: () => set((s) => ({ composerOpen: !s.composerOpen })),
  setComposer: (open) => set({ composerOpen: open })
}))
