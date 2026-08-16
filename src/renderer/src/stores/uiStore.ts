import { create } from 'zustand'

export type LeftView =
  | 'explorer'
  | 'git'
  | 'health'
  | 'brain'
  | 'arch'
  | 'watcher'
  | 'bug'
  | 'agent'
  | 'activity'
  | 'goal'
  | 'heal'
  | 'tests'
  | 'timemachine'
  | 'memory'
  | 'risk'
  | 'beginner'
  | 'safe'
  | 'builder'
  | 'settings'
export type BottomTab = 'terminal' | 'problems' | 'whatsnext'

/** Cross-cutting UI state: active panels, bottom tab, command palette. */
interface UiState {
  leftView: LeftView
  setLeftView: (v: LeftView) => void

  terminalOpen: boolean
  toggleTerminal: () => void
  setTerminal: (open: boolean) => void

  bottomTab: BottomTab
  setBottomTab: (t: BottomTab) => void

  paletteOpen: boolean
  setPalette: (open: boolean) => void
  togglePalette: () => void

  /** "Why?" explanation overlay text (null = hidden). */
  whyText: string | null
  setWhy: (text: string | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  leftView: 'explorer',
  setLeftView: (leftView) => set({ leftView }),

  terminalOpen: false,
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  setTerminal: (open) => set({ terminalOpen: open }),

  bottomTab: 'terminal',
  setBottomTab: (bottomTab) => set({ bottomTab }),

  paletteOpen: false,
  setPalette: (open) => set({ paletteOpen: open }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),

  whyText: null,
  setWhy: (whyText) => set({ whyText })
}))
