import { create } from 'zustand'
import type { VerifyResult } from '@shared/engine'
import { useWorkspaceStore } from './workspaceStore'
import { notify } from './notifyStore'

/**
 * Test Guardian run state (spec §23-§24). Coverage itself is derived in the
 * panel straight from the Project Brain; this store only owns the "run the test
 * suite" action + its captured result, reusing the verification runner.
 */
interface TestGuardianState {
  hasTestScript: boolean | null
  running: boolean
  result: VerifyResult | null

  checkScript: (root: string) => Promise<void>
  runTests: () => Promise<void>
}

export const useTestGuardianStore = create<TestGuardianState>((set, get) => ({
  hasTestScript: null,
  running: false,
  result: null,

  checkScript: async (root) => {
    try {
      const res = await window.lumixa.verify.scripts(root)
      set({ hasTestScript: res.available.includes('test') })
    } catch {
      set({ hasTestScript: false })
    }
  },

  runTests: async () => {
    if (get().running) return
    const root = useWorkspaceStore.getState().root
    if (!root) return
    set({ running: true, result: null })
    try {
      const result = await window.lumixa.verify.run(root, 'test')
      set({ result, running: false })
      notify(result.ok ? 'success' : 'warn', result.ok ? '✓ Tests passed' : '⚠ Tests failed')
    } catch {
      set({ running: false })
    }
  }
}))
