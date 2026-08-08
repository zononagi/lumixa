import { create } from 'zustand'

/** Cross-cutting UI visibility state (bottom terminal panel). */
interface UiState {
  terminalOpen: boolean
  toggleTerminal: () => void
  setTerminal: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  terminalOpen: false,
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  setTerminal: (open) => set({ terminalOpen: open })
}))
