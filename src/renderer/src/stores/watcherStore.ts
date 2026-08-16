import { create } from 'zustand'
import type { WatcherFinding } from '@shared/brain'

/**
 * AI Code Watcher (renderer). Pulls the static findings the Project Brain
 * produced during indexing and lets the user dismiss ones they don't care about.
 * Ignored ids persist in localStorage so they stay dismissed across sessions
 * (spec §13-§14 — respect the user, no nagging).
 */

const IGNORE_KEY = 'lumixa.watcher.ignored'

function loadIgnored(): Set<string> {
  try {
    const raw = localStorage.getItem(IGNORE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveIgnored(set: Set<string>): void {
  try {
    localStorage.setItem(IGNORE_KEY, JSON.stringify([...set]))
  } catch {
    /* ignore quota errors */
  }
}

interface WatcherState {
  findings: WatcherFinding[]
  ignored: Set<string>
  showLow: boolean

  refresh: (root: string) => Promise<void>
  ignore: (id: string) => void
  clearIgnored: () => void
  setShowLow: (v: boolean) => void
  /** Findings after applying the ignore list + confidence filter. */
  visible: () => WatcherFinding[]
}

export const useWatcherStore = create<WatcherState>((set, get) => ({
  findings: [],
  ignored: loadIgnored(),
  showLow: false,

  refresh: async (root) => {
    try {
      const findings = await window.lumixa.brain.findings(root)
      set({ findings })
    } catch {
      set({ findings: [] })
    }
  },

  ignore: (id) => {
    const ignored = new Set(get().ignored)
    ignored.add(id)
    saveIgnored(ignored)
    set({ ignored })
  },

  clearIgnored: () => {
    saveIgnored(new Set())
    set({ ignored: new Set() })
  },

  setShowLow: (showLow) => set({ showLow }),

  visible: () => {
    const { findings, ignored, showLow } = get()
    const order = { high: 0, medium: 1, low: 2 } as const
    return findings
      .filter((f) => !ignored.has(f.id))
      .filter((f) => showLow || f.confidence !== 'low')
      .sort(
        (a, b) =>
          order[a.confidence] - order[b.confidence] ||
          a.rel.localeCompare(b.rel) ||
          a.line - b.line
      )
  }
}))
