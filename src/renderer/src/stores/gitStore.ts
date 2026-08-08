import { create } from 'zustand'
import type { GitStatus } from '@shared/ipc'
import { useWorkspaceStore } from './workspaceStore'

interface GitState {
  status: GitStatus | null
  branches: string[]
  history: string[]
  message: string
  busy: boolean
  lastError: string | null

  setMessage: (m: string) => void
  refresh: () => Promise<void>
  loadHistory: () => Promise<void>
  stage: (path: string) => Promise<void>
  unstage: (path: string) => Promise<void>
  stageAll: () => Promise<void>
  commit: () => Promise<void>
  push: () => Promise<void>
  pull: () => Promise<void>
  checkout: (branch: string, create?: boolean) => Promise<void>
  merge: (branch: string) => Promise<void>
  rebase: (branch: string) => Promise<void>
  stash: () => Promise<void>
  stashPop: () => Promise<void>
  continueOp: () => Promise<void>
  abortOp: () => Promise<void>
}

const root = (): string | null => useWorkspaceStore.getState().root

export const useGitStore = create<GitState>((set, get) => ({
  status: null,
  branches: [],
  history: [],
  message: '',
  busy: false,
  lastError: null,

  setMessage: (m) => set({ message: m }),

  loadHistory: async () => {
    const r = root()
    if (!r) return
    set({ history: await window.lumixa.git.log(r) })
  },

  refresh: async () => {
    const r = root()
    if (!r) {
      set({ status: null, branches: [] })
      return
    }
    const status = await window.lumixa.git.status(r)
    set({ status })
    if (status.isRepo) {
      const b = await window.lumixa.git.branches(r)
      set({ branches: b.all })
    }
  },

  stage: async (path) => {
    const r = root()
    if (!r) return
    await window.lumixa.git.stage(r, path)
    await get().refresh()
  },

  unstage: async (path) => {
    const r = root()
    if (!r) return
    await window.lumixa.git.unstage(r, path)
    await get().refresh()
  },

  stageAll: async () => {
    const r = root()
    if (!r) return
    await window.lumixa.git.stageAll(r)
    await get().refresh()
  },

  commit: async () => {
    const r = root()
    if (!r || !get().message.trim()) return
    set({ busy: true, lastError: null })
    const res = await window.lumixa.git.commit(r, get().message.trim())
    set({ busy: false })
    if (res.ok) set({ message: '' })
    else set({ lastError: res.output })
    await get().refresh()
  },

  push: async () => {
    const r = root()
    if (!r) return
    set({ busy: true, lastError: null })
    const res = await window.lumixa.git.push(r)
    set({ busy: false, lastError: res.ok ? null : res.output })
    await get().refresh()
  },

  pull: async () => {
    const r = root()
    if (!r) return
    set({ busy: true, lastError: null })
    const res = await window.lumixa.git.pull(r)
    set({ busy: false, lastError: res.ok ? null : res.output })
    await get().refresh()
  },

  // Run a git operation, surface its output on failure, then refresh.
  ...(() => {
    const run = async (
      fn: (r: string) => Promise<{ ok: boolean; output: string }>
    ): Promise<void> => {
      const r = root()
      if (!r) return
      set({ busy: true, lastError: null })
      const res = await fn(r)
      set({ busy: false, lastError: res.ok ? null : res.output })
      await get().refresh()
    }
    return {
      checkout: (branch: string, create = false) =>
        run((r) => window.lumixa.git.checkout(r, branch, create)),
      merge: (branch: string) => run((r) => window.lumixa.git.merge(r, branch)),
      rebase: (branch: string) => run((r) => window.lumixa.git.rebase(r, branch)),
      stash: () => run((r) => window.lumixa.git.stash(r)),
      stashPop: () => run((r) => window.lumixa.git.stashPop(r)),
      continueOp: () =>
        run((r) =>
          get().status?.operation === 'merge'
            ? window.lumixa.git.commit(r, 'Merge')
            : window.lumixa.git.rebaseContinue(r)
        ),
      abortOp: () =>
        run((r) =>
          get().status?.operation === 'merge'
            ? window.lumixa.git.mergeAbort(r)
            : window.lumixa.git.rebaseAbort(r)
        )
    }
  })()
}))
