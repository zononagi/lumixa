import { create } from 'zustand'
import { useWorkspaceStore } from './workspaceStore'
import { notify } from './notifyStore'

/**
 * Risk Detector store (spec §36). Tracks which files currently have uncommitted
 * changes (via git status) so the panel can flag risky changes in progress. The
 * critical-area classification itself is pure (features/risk/risk.ts) over the
 * Project Brain file list.
 */
interface RiskState {
  changed: Set<string>
  loading: boolean
  refresh: (root: string) => Promise<void>
  snapshot: () => Promise<void>
}

export const useRiskStore = create<RiskState>((set) => ({
  changed: new Set(),
  loading: false,

  refresh: async (root) => {
    set({ loading: true })
    try {
      const status = await window.lumixa.git.status(root)
      // Normalise git paths (posix, repo-relative) to match Brain rel keys.
      const changed = new Set(status.files.map((f) => f.path.replace(/\\/g, '/')))
      set({ changed, loading: false })
    } catch {
      set({ changed: new Set(), loading: false })
    }
  },

  snapshot: async () => {
    const root = useWorkspaceStore.getState().root
    if (!root) return
    try {
      const res = await window.lumixa.snapshot.create(root, 'Before risky change')
      notify(res.ok ? 'success' : 'warn', res.message)
    } catch {
      notify('warn', 'Could not create a snapshot.')
    }
  }
}))
