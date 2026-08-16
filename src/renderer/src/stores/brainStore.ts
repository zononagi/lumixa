import { create } from 'zustand'
import type { ImpactResult, ProjectBrain } from '@shared/brain'
import { logActivity } from './activityStore'

/**
 * Renderer-side Project Brain state. Holds the structural index built by the
 * main process and the Change Impact result for the file currently in focus.
 *
 * Indexing is triggered on workspace open and kept fresh incrementally as files
 * are saved or changed by Claude Code (wired from the workspace/editor/agent
 * flows). Re-index requests are coalesced so rapid saves don't pile up.
 */
interface BrainState {
  brain: ProjectBrain | null
  indexing: boolean
  error: string | null

  /** Impact for the file the user is looking at. */
  impact: ImpactResult | null
  impactPath: string | null

  index: (root: string) => Promise<void>
  touchFile: (root: string, path: string) => void
  analyzeImpact: (root: string, path: string) => Promise<void>
  clear: () => void
}

let pending: Map<string, ReturnType<typeof setTimeout>> = new Map()

export const useBrainStore = create<BrainState>((set, get) => ({
  brain: null,
  indexing: false,
  error: null,
  impact: null,
  impactPath: null,

  index: async (root) => {
    set({ indexing: true, error: null })
    logActivity('brain', 'running', 'act.brain.indexing')
    try {
      const brain = await window.lumixa.brain.index(root)
      set({ brain, indexing: false })
      logActivity('brain', 'done', 'act.brain.indexed', { n: brain.stats.files })
    } catch (e) {
      set({ indexing: false, error: e instanceof Error ? e.message : 'Indexing failed' })
      logActivity('brain', 'error', 'act.brain.error')
    }
  },

  // Debounced incremental update (spec §6, §48 — coalesce rapid saves).
  touchFile: (root, path) => {
    const existing = pending.get(path)
    if (existing) clearTimeout(existing)
    pending.set(
      path,
      setTimeout(() => {
        pending.delete(path)
        void window.lumixa.brain
          .updateFile(root, path)
          .then((brain) => {
            if (brain) set({ brain })
            // Refresh impact if it was for this file.
            const { impactPath } = get()
            if (impactPath === path) void get().analyzeImpact(root, path)
          })
          .catch(() => {})
      }, 400)
    )
  },

  analyzeImpact: async (root, path) => {
    try {
      const impact = await window.lumixa.brain.impact(root, path)
      set({ impact, impactPath: path })
    } catch {
      set({ impact: null, impactPath: path })
    }
  },

  clear: () => {
    for (const t of pending.values()) clearTimeout(t)
    pending = new Map()
    set({ brain: null, impact: null, impactPath: null, error: null })
  }
}))
