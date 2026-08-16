import { create } from 'zustand'
import { useAgentStore } from './agentStore'
import { notify } from './notifyStore'
import {
  buildBreakdownPrompt,
  buildTaskPrompt,
  parseTasksFromResponse,
  type Goal,
  type GoalTask
} from '@renderer/features/goal/goal'
import { useBrainStore } from './brainStore'

/**
 * Goal Mode store (spec §29-§32). Owns the active goal per workspace (persisted
 * in localStorage), asks Claude Code to break it into checkable tasks, and hands
 * individual tasks back to Claude. Progress is NOT stored — it is computed from
 * live project state by the panel, so it can never drift from reality (§32).
 */
const keyFor = (root: string): string => `lumixa.goal.${root}`

function load(root: string): Goal | null {
  try {
    const raw = localStorage.getItem(keyFor(root))
    return raw ? (JSON.parse(raw) as Goal) : null
  } catch {
    return null
  }
}
function save(root: string, goal: Goal | null): void {
  try {
    if (goal) localStorage.setItem(keyFor(root), JSON.stringify(goal))
    else localStorage.removeItem(keyFor(root))
  } catch {
    /* ignore quota */
  }
}

interface GoalState {
  root: string | null
  goal: Goal | null
  input: string
  generating: boolean

  setInput: (v: string) => void
  loadFor: (root: string) => void
  create: () => void
  generate: () => Promise<void>
  toggleManual: (taskId: string) => void
  buildTask: (task: GoalTask) => Promise<void>
  reset: () => void
}

export const useGoalStore = create<GoalState>((set, get) => ({
  root: null,
  goal: null,
  input: '',
  generating: false,

  setInput: (input) => set({ input }),

  loadFor: (root) => set({ root, goal: load(root), input: '' }),

  create: () => {
    const { root, input } = get()
    const text = input.trim()
    if (!root || !text) return
    const goal: Goal = { text, tasks: [], createdAt: Date.now() }
    save(root, goal)
    set({ goal })
  },

  generate: async () => {
    const { root, goal, input } = get()
    const text = (goal?.text ?? input).trim()
    if (!root || !text) {
      notify('info', 'Describe your goal first.')
      return
    }
    const agent = useAgentStore.getState()
    if (!agent.providers.some((p) => p.id === 'claude-code' && p.state === 'authenticated')) {
      notify('warn', 'Claude Code is needed to break the goal into tasks.')
      return
    }
    set({ generating: true })
    const id = await agent.createSession('claude-code')
    if (!id) {
      set({ generating: false })
      return
    }
    void agent.rename(id, 'Goal breakdown')
    const summary = useBrainStore.getState().brain?.summary ?? null
    const res = await agent.sendAndWait(id, buildBreakdownPrompt(text, summary))
    const tasks = res.ok && res.result ? parseTasksFromResponse(res.result) : []
    if (tasks.length === 0) {
      set({ generating: false })
      notify('warn', 'Could not read a task list from the response — try rephrasing the goal.')
      return
    }
    const next: Goal = { text, tasks, createdAt: goal?.createdAt ?? Date.now() }
    save(root, next)
    set({ goal: next, generating: false, input: '' })
    notify('success', `Goal broken into ${tasks.length} tasks`)
  },

  toggleManual: (taskId) => {
    const { root, goal } = get()
    if (!root || !goal) return
    const tasks = goal.tasks.map((t) =>
      t.id === taskId && t.check.type === 'manual' ? { ...t, manualDone: !t.manualDone } : t
    )
    const next = { ...goal, tasks }
    save(root, next)
    set({ goal: next })
  },

  buildTask: async (task) => {
    const goal = get().goal
    if (!goal) return
    await useAgentStore.getState().requestPrefill(buildTaskPrompt(goal.text, task), [], true)
  },

  reset: () => {
    const root = get().root
    if (root) save(root, null)
    set({ goal: null, input: '' })
  }
}))
