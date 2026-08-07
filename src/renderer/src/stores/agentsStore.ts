import { create } from 'zustand'

/**
 * Agents: named profiles that each carry a custom System Prompt and an optional
 * pinned model. The active agent drives the Chat panel. Persisted to
 * localStorage so a user's agents survive restarts.
 */
export interface Agent {
  id: string
  name: string
  systemPrompt: string
  /** Pinned model id, or null to follow the globally selected model. */
  model: string | null
}

const DEFAULT_PROMPT =
  'You are Lumixa, an AI pair-programmer embedded in a code editor. Be concise and practical.'

const uid = (): string => Math.random().toString(36).slice(2) + Date.now().toString(36)

function seed(): Agent[] {
  return [
    { id: 'default', name: 'Lumixa', systemPrompt: DEFAULT_PROMPT, model: null },
    {
      id: uid(),
      name: 'Reviewer',
      systemPrompt:
        'You are a meticulous senior code reviewer. Point out bugs, edge cases and security issues first, then style. Be direct and cite line references.',
      model: null
    }
  ]
}

interface AgentsState {
  agents: Agent[]
  activeId: string
  active: () => Agent
  setActive: (id: string) => void
  add: () => string
  update: (id: string, patch: Partial<Omit<Agent, 'id'>>) => void
  remove: (id: string) => void
}

const KEY = 'lumixa.agents'

function load(): { agents: Agent[]; activeId: string } {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { agents: Agent[]; activeId: string }
      if (parsed.agents?.length) return parsed
    }
  } catch {
    /* ignore */
  }
  const agents = seed()
  return { agents, activeId: agents[0].id }
}

export const useAgentsStore = create<AgentsState>((set, get) => {
  const initial = load()
  const persist = (): void => {
    const { agents, activeId } = get()
    localStorage.setItem(KEY, JSON.stringify({ agents, activeId }))
  }

  return {
    agents: initial.agents,
    activeId: initial.activeId,

    active: () => {
      const { agents, activeId } = get()
      return agents.find((a) => a.id === activeId) ?? agents[0]
    },
    setActive: (id) => {
      set({ activeId: id })
      persist()
    },
    add: () => {
      const agent: Agent = { id: uid(), name: 'New agent', systemPrompt: DEFAULT_PROMPT, model: null }
      set((s) => ({ agents: [...s.agents, agent], activeId: agent.id }))
      persist()
      return agent.id
    },
    update: (id, patch) => {
      set((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
      persist()
    },
    remove: (id) => {
      set((s) => {
        if (s.agents.length <= 1) return s // always keep at least one
        const agents = s.agents.filter((a) => a.id !== id)
        const activeId = s.activeId === id ? agents[0].id : s.activeId
        return { agents, activeId }
      })
      persist()
    }
  }
})
