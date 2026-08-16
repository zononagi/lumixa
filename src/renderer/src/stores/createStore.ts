import { create } from 'zustand'
import type { ScaffoldResult } from '@shared/create'
import { analyzeDescription, slugify } from '@renderer/features/create/plan'
import { useWorkspaceStore } from './workspaceStore'
import { useGoalStore } from './goalStore'
import { useUiStore } from './uiStore'
import { logActivity } from './activityStore'
import { notify } from './notifyStore'

/**
 * New Project wizard state + orchestration (Project Creation Engine, spec §1-§9,
 * §31-§32). Analyzes a natural-language description into a plan, scaffolds a real
 * project, opens it (which triggers Project Brain indexing), and seeds Goal Mode
 * from the description so creation flows straight into guided development.
 *
 * Side-effectful follow-ups (install deps, Claude implementation) are explicit
 * buttons in the result step — never auto-run (§35).
 */
export type CreateStep = 'describe' | 'plan' | 'result'

interface CreateState {
  step: CreateStep
  description: string
  name: string
  templateId: string
  features: string[]
  parentDir: string | null
  creating: boolean
  result: ScaffoldResult | null

  setDescription: (v: string) => void
  setName: (v: string) => void
  setTemplateId: (id: string) => void
  removeFeature: (f: string) => void
  browse: () => Promise<void>
  analyze: () => void
  back: () => void
  createProject: () => Promise<void>
  reset: () => void
}

function joinPath(parent: string, name: string): string {
  const sep = parent.includes('\\') ? '\\' : '/'
  return parent.replace(/[\\/]+$/, '') + sep + name
}

export const useCreateStore = create<CreateState>((set, get) => ({
  step: 'describe',
  description: '',
  name: '',
  templateId: 'react-ts-vite',
  features: [],
  parentDir: null,
  creating: false,
  result: null,

  setDescription: (description) => set({ description }),
  setName: (name) => set({ name: slugify(name) }),
  setTemplateId: (templateId) => set({ templateId }),
  removeFeature: (f) => set((s) => ({ features: s.features.filter((x) => x !== f) })),

  browse: async () => {
    const res = await window.lumixa.fs.openFolder()
    if (res) set({ parentDir: res.root })
  },

  analyze: () => {
    const desc = get().description.trim()
    if (!desc) {
      notify('info', 'Describe what you want to build first.')
      return
    }
    const plan = analyzeDescription(desc)
    set({
      name: plan.name,
      templateId: plan.templateId,
      features: plan.features,
      step: 'plan'
    })
  },

  back: () => set({ step: 'describe' }),

  createProject: async () => {
    const { parentDir, name, templateId, features, description } = get()
    if (!parentDir) {
      notify('warn', 'Choose a location for the new project.')
      return
    }
    if (!name) {
      notify('warn', 'Give the project a name.')
      return
    }
    set({ creating: true, result: null })
    logActivity('brain', 'running', 'act.create.creating', { name })
    const targetDir = joinPath(parentDir, name)
    const result = await window.lumixa.create.scaffold({ targetDir, name, templateId, features })
    if (!result.ok || !result.root) {
      set({ creating: false, result })
      notify('warn', result.message)
      return
    }
    // Open the new project → Project Brain indexes it automatically (§32).
    await useWorkspaceStore.getState().openPath(result.root, name)
    // Seed Goal Mode from the description (§31) so dev flows straight on.
    if (description.trim()) {
      const goal = useGoalStore.getState()
      goal.loadFor(result.root)
      goal.setInput(description.trim())
      goal.create()
    }
    logActivity('brain', 'done', 'act.create.created', { name })
    set({ creating: false, result, step: 'result' })
    notify('success', `✓ Project "${name}" created`)
  },

  reset: () => {
    useUiStore.getState().setNewProject(false)
    set({
      step: 'describe',
      description: '',
      name: '',
      templateId: 'react-ts-vite',
      features: [],
      parentDir: null,
      creating: false,
      result: null
    })
  }
}))
