import { create } from 'zustand'
import type { ChatMessage } from '@shared/ipc'
import { useSettingsStore } from './settingsStore'

/**
 * Background execution. Runs an agent completion off the main chat flow so the
 * user can keep working while it finishes. Tasks stream to completion in the
 * main process; the store tracks their status and result.
 */
export interface BgTask {
  id: string
  title: string
  status: 'running' | 'done' | 'error'
  result?: string
  error?: string
  createdAt: number
}

interface TasksState {
  tasks: BgTask[]
  runningCount: () => number
  run: (title: string, system: string, user: string, model?: string) => Promise<string>
  clearFinished: () => void
}

const uid = (): string => Math.random().toString(36).slice(2) + Date.now().toString(36)

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],

  runningCount: () => get().tasks.filter((t) => t.status === 'running').length,

  run: async (title, system, user, model) => {
    const { selectedModel, models } = useSettingsStore.getState()
    const useModel = model ?? selectedModel
    const id = uid()
    const task: BgTask = { id, title, status: 'running', createdAt: Date.now() }
    set((s) => ({ tasks: [task, ...s.tasks] }))

    if (!useModel) {
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, status: 'error', error: 'No model selected.' } : t
        )
      }))
      return id
    }

    const provider = models.find((m) => m.id === useModel)?.provider ?? 'anthropic'
    const messages: ChatMessage[] = [{ role: 'user', content: user }]
    const res = await window.lumixa.ai.complete({ provider, model: useModel, system, messages })

    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? res.error
            ? { ...t, status: 'error', error: res.error }
            : { ...t, status: 'done', result: res.text }
          : t
      )
    }))
    return id
  },

  clearFinished: () => set((s) => ({ tasks: s.tasks.filter((t) => t.status === 'running') }))
}))
