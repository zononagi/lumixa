import { create } from 'zustand'
import type { GitStatus } from '@shared/ipc'
import { useWorkspaceStore } from './workspaceStore'
import { complete } from '@renderer/lib/ai'

const COMMIT_SYSTEM = `You write git commit messages. Given a staged diff, produce ONE concise Conventional Commits message (e.g. "feat: ...", "fix: ...", "refactor: ...").
Return ONLY the message — a subject line under 72 chars, optionally a blank line and short body. No markdown, no quotes, no explanation.`

interface GitState {
  status: GitStatus | null
  branches: string[]
  message: string
  busy: boolean
  generating: boolean
  lastError: string | null

  setMessage: (m: string) => void
  refresh: () => Promise<void>
  stage: (path: string) => Promise<void>
  unstage: (path: string) => Promise<void>
  stageAll: () => Promise<void>
  commit: () => Promise<void>
  push: () => Promise<void>
  pull: () => Promise<void>
  generateMessage: () => Promise<void>
  checkout: (branch: string, create?: boolean) => Promise<void>
  merge: (branch: string) => Promise<void>
  rebase: (branch: string) => Promise<void>
  continueOp: () => Promise<void>
  abortOp: () => Promise<void>
}

const root = (): string | null => useWorkspaceStore.getState().root

export const useGitStore = create<GitState>((set, get) => ({
  status: null,
  branches: [],
  message: '',
  busy: false,
  generating: false,
  lastError: null,

  setMessage: (m) => set({ message: m }),

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

  generateMessage: async () => {
    const r = root()
    if (!r) return
    set({ generating: true, lastError: null })
    const diff = await window.lumixa.git.stagedDiff(r)
    if (!diff.trim()) {
      set({ generating: false, lastError: 'No staged changes to summarize.' })
      return
    }
    // Bound the diff so the prompt stays reasonable.
    const clipped = diff.length > 12000 ? diff.slice(0, 12000) + '\n…(truncated)' : diff
    const res = await complete(COMMIT_SYSTEM, `Staged diff:\n\n${clipped}`)
    set({ generating: false })
    if (res.error) set({ lastError: res.error })
    else set({ message: res.text.trim() })
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
