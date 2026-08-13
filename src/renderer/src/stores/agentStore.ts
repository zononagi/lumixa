import { create } from 'zustand'
import type {
  AgentEvent,
  AgentSession,
  FileChangeType,
  PermissionMode,
  ProviderStatus
} from '@shared/agent'
import { useWorkspaceStore } from './workspaceStore'
import { useEditorStore } from './editorStore'
import { useUsageStore } from './usageStore'

/**
 * Renderer-side agent state. Subscribes to the streaming events pushed by the
 * main process and folds them into a per-session conversation view. Knows
 * nothing about Claude Code specifics — only the generic event shapes.
 */

export type ToolStatus = 'running' | 'done' | 'error'

export interface ToolCallView {
  id: string
  name: string
  summary: string
  status: ToolStatus
  resultSummary?: string
}

export type ChatItem =
  | { type: 'user'; text: string }
  | { type: 'assistant'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool'; call: ToolCallView }
  | { type: 'permission'; tool: string; detail: string }
  | { type: 'error'; friendly: string }
  | { type: 'completed'; result?: string; costUsd?: number }

export interface FileChangeView {
  path: string
  changeType: FileChangeType
}

export interface SessionView {
  session: AgentSession
  items: ChatItem[]
  fileChanges: FileChangeView[]
}

interface AgentState {
  providers: ProviderStatus[]
  loadingProviders: boolean
  sessionsById: Record<string, SessionView>
  order: string[]
  activeId: string | null
  permissionMode: PermissionMode

  init: () => void
  refreshProviders: () => Promise<void>
  setPermissionMode: (m: PermissionMode) => void
  createSession: (providerId: string, model?: string) => Promise<string | null>
  setActive: (id: string) => void
  send: (id: string, text: string) => Promise<void>
  stop: (id: string) => Promise<void>
  closeSession: (id: string) => Promise<void>
}

let subscribed = false

export const useAgentStore = create<AgentState>((set, get) => ({
  providers: [],
  loadingProviders: false,
  sessionsById: {},
  order: [],
  activeId: null,
  permissionMode: 'default',

  init: () => {
    if (subscribed) return
    subscribed = true
    window.lumixa.agent.onEvent(({ sessionId, event }) => applyEvent(set, get, sessionId, event))
    window.lumixa.agent.onSessionUpdate(({ session }) => {
      set((s) => {
        const view = s.sessionsById[session.id]
        if (!view) return s
        return {
          sessionsById: { ...s.sessionsById, [session.id]: { ...view, session } }
        }
      })
    })
    void get().refreshProviders()
  },

  refreshProviders: async () => {
    set({ loadingProviders: true })
    try {
      const providers = await window.lumixa.agent.listProviders()
      set({ providers })
    } finally {
      set({ loadingProviders: false })
    }
  },

  setPermissionMode: (permissionMode) => set({ permissionMode }),

  createSession: async (providerId, model) => {
    const workspacePath = useWorkspaceStore.getState().root
    if (!workspacePath) return null
    const session = await window.lumixa.agent.startSession({
      providerId,
      workspacePath,
      model,
      permissionMode: get().permissionMode
    })
    set((s) => ({
      sessionsById: { ...s.sessionsById, [session.id]: { session, items: [], fileChanges: [] } },
      order: [session.id, ...s.order],
      activeId: session.id
    }))
    useUsageStore.getState().bumpSessions()
    return session.id
  },

  setActive: (activeId) => set({ activeId }),

  send: async (id, text) => {
    const view = get().sessionsById[id]
    if (!view) return
    appendItem(set, id, { type: 'user', text })
    useUsageStore.getState().bumpMessages()
    await window.lumixa.agent.sendMessage(id, text)
  },

  stop: async (id) => {
    await window.lumixa.agent.stop(id)
  },

  closeSession: async (id) => {
    await window.lumixa.agent.dispose(id)
    set((s) => {
      const rest = { ...s.sessionsById }
      delete rest[id]
      const order = s.order.filter((x) => x !== id)
      return {
        sessionsById: rest,
        order,
        activeId: s.activeId === id ? (order[0] ?? null) : s.activeId
      }
    })
  }
}))

// ---------------------------------------------------------------------------
// Event folding
// ---------------------------------------------------------------------------

type SetFn = (fn: (s: AgentState) => Partial<AgentState>) => void

function appendItem(set: SetFn, id: string, item: ChatItem): void {
  set((s) => {
    const view = s.sessionsById[id]
    if (!view) return {}
    return {
      sessionsById: { ...s.sessionsById, [id]: { ...view, items: [...view.items, item] } }
    }
  })
}

function applyEvent(
  set: SetFn,
  get: () => AgentState,
  id: string,
  event: AgentEvent
): void {
  const view = get().sessionsById[id]
  if (!view) return

  switch (event.kind) {
    case 'assistant-text': {
      // Merge consecutive assistant text into one bubble.
      const items = [...view.items]
      const last = items[items.length - 1]
      if (last && last.type === 'assistant') {
        items[items.length - 1] = { type: 'assistant', text: last.text + event.text }
      } else {
        items.push({ type: 'assistant', text: event.text })
      }
      commit(set, id, { items })
      break
    }
    case 'assistant-thinking':
      appendItem(set, id, { type: 'thinking', text: event.text })
      break
    case 'tool-call':
      appendItem(set, id, {
        type: 'tool',
        call: { id: event.toolCallId, name: event.name, summary: event.summary, status: 'running' }
      })
      useUsageStore.getState().bumpToolCalls()
      break
    case 'tool-result': {
      const items = view.items.map((it) =>
        it.type === 'tool' && it.call.id === event.toolCallId
          ? {
              ...it,
              call: {
                ...it.call,
                status: (event.isError ? 'error' : 'done') as ToolStatus,
                resultSummary: event.summary
              }
            }
          : it
      )
      commit(set, id, { items })
      break
    }
    case 'file-change': {
      const existing = view.fileChanges.find((f) => f.path === event.path)
      const fileChanges = existing
        ? view.fileChanges
        : [...view.fileChanges, { path: event.path, changeType: event.changeType }]
      if (!existing) useUsageStore.getState().bumpFilesModified()
      commit(set, id, { fileChanges })
      // If the file is open, reflect the on-disk change live.
      void reloadOpenTab(event.path)
      break
    }
    case 'permission-request':
      appendItem(set, id, { type: 'permission', tool: event.tool, detail: event.detail })
      break
    case 'error':
      appendItem(set, id, { type: 'error', friendly: event.friendly })
      break
    case 'completed':
      appendItem(set, id, { type: 'completed', result: event.result, costUsd: event.costUsd })
      if (typeof event.durationMs === 'number') useUsageStore.getState().addRuntime(event.durationMs)
      break
    case 'session-init':
      // Nothing user-facing to add; status updates arrive separately.
      break
  }
}

function commit(set: SetFn, id: string, patch: Partial<SessionView>): void {
  set((s) => {
    const view = s.sessionsById[id]
    if (!view) return {}
    return { sessionsById: { ...s.sessionsById, [id]: { ...view, ...patch } } }
  })
}

async function reloadOpenTab(path: string): Promise<void> {
  const editor = useEditorStore.getState()
  if (!editor.tabs.some((t) => t.path === path)) return
  try {
    const content = await window.lumixa.fs.readFile(path)
    useEditorStore.getState().setSavedContent(path, content)
  } catch {
    /* file may have been deleted; ignore */
  }
}
