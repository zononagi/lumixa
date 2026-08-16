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
import { useUiStore } from './uiStore'
import { notify } from './notifyStore'
import {
  composeMessage,
  gatherContext,
  hasSelection,
  type ContextKind
} from '@renderer/features/agent/agentContext'
import type { QuickAction } from '@renderer/features/agent/quickActions'

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
  | { type: 'user'; text: string; contexts?: ContextKind[] }
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

/** A request from outside the panel (editor menu, Problems tab) to prime the
 *  composer with text + context and, optionally, send immediately. */
export interface Prefill {
  nonce: number
  text: string
  contexts: ContextKind[]
  autoSend: boolean
}

interface AgentState {
  providers: ProviderStatus[]
  loadingProviders: boolean
  sessionsById: Record<string, SessionView>
  order: string[]
  activeId: string | null
  permissionMode: PermissionMode

  /** Context kinds staged for the next message (the "+ Context" chips). */
  attachments: ContextKind[]
  /** Cross-component composer priming (consumed by the active Conversation). */
  prefill: Prefill | null

  /** Captured pre-edit file contents, keyed `${sessionId}\0${path}` (for diffs). */
  beforeByKey: Record<string, string>
  /** File currently shown in the diff viewer, if any. */
  diffTarget: { sessionId: string; path: string } | null

  init: () => void
  refreshProviders: () => Promise<void>
  setPermissionMode: (m: PermissionMode) => void
  createSession: (providerId: string, model?: string) => Promise<string | null>
  setActive: (id: string) => void
  send: (id: string, text: string, contexts?: ContextKind[]) => Promise<void>
  stop: (id: string) => Promise<void>
  rename: (id: string, title: string) => Promise<void>
  closeSession: (id: string) => Promise<void>

  toggleAttachment: (kind: ContextKind) => void
  clearAttachments: () => void

  /** Ensure an active session exists (creating one if needed); returns its id. */
  ensureSession: () => Promise<string | null>
  /** Send composer text, auto-creating a session and using staged attachments. */
  submitComposer: (text: string) => Promise<void>
  /** Run a one-tap Quick Action against the current selection/file. */
  runQuickAction: (action: QuickAction) => Promise<void>
  /** Prime the composer from outside the panel and reveal the Agent view. */
  requestPrefill: (text: string, contexts: ContextKind[], autoSend?: boolean) => Promise<void>
  consumePrefill: () => void

  openDiff: (sessionId: string, path: string) => void
  closeDiff: () => void
  rejectDiff: () => Promise<void>
}

let subscribed = false
const keyOf = (sessionId: string, path: string): string => `${sessionId}::${path}`

export const useAgentStore = create<AgentState>((set, get) => ({
  providers: [],
  loadingProviders: false,
  sessionsById: {},
  order: [],
  activeId: null,
  permissionMode: 'default',
  attachments: [],
  prefill: null,
  beforeByKey: {},
  diffTarget: null,

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

  send: async (id, text, contexts) => {
    const view = get().sessionsById[id]
    if (!view) return
    const kinds = contexts ?? get().attachments
    const blocks = await gatherContext(kinds)
    const full = composeMessage(text, blocks)

    appendItem(set, id, {
      type: 'user',
      text,
      contexts: blocks.map((b) => b.kind)
    })
    useUsageStore.getState().bumpMessages()

    // Give a brand-new session a clean title from the user's own words (not the
    // context-prefixed payload) before the runtime auto-titles from the message.
    if (view.session.title === 'New session') {
      await window.lumixa.agent.rename(id, text)
    }
    if (contexts === undefined) get().clearAttachments()
    await window.lumixa.agent.sendMessage(id, full)
  },

  stop: async (id) => {
    await window.lumixa.agent.stop(id)
  },

  rename: async (id, title) => {
    const clean = title.trim()
    if (!clean) return
    await window.lumixa.agent.rename(id, clean)
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
        activeId: s.activeId === id ? (order[0] ?? null) : s.activeId,
        diffTarget: s.diffTarget?.sessionId === id ? null : s.diffTarget
      }
    })
  },

  toggleAttachment: (kind) =>
    set((s) => ({
      attachments: s.attachments.includes(kind)
        ? s.attachments.filter((k) => k !== kind)
        : [...s.attachments, kind]
    })),

  clearAttachments: () => set({ attachments: [] }),

  ensureSession: async () => {
    const { activeId, sessionsById } = get()
    if (activeId && sessionsById[activeId]) return activeId
    return get().createSession('claude-code')
  },

  submitComposer: async (text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const id = await get().ensureSession()
    if (!id) return
    await get().send(id, trimmed)
  },

  runQuickAction: async (action) => {
    const id = await get().ensureSession()
    if (!id) return
    const contexts: ContextKind[] = []
    if (action.codeScoped) contexts.push(hasSelection() ? 'selection' : 'file')
    if (action.extraContext) contexts.push(...action.extraContext)
    await get().send(id, action.prompt, contexts)
  },

  requestPrefill: async (text, contexts, autoSend = false) => {
    useUiStore.getState().setLeftView('agent')
    const id = await get().ensureSession()
    if (!id) return
    if (autoSend) {
      await get().send(id, text, contexts)
      return
    }
    set((s) => ({
      prefill: { nonce: (s.prefill?.nonce ?? 0) + 1, text, contexts, autoSend: false }
    }))
  },

  consumePrefill: () => set({ prefill: null }),

  openDiff: (sessionId, path) => set({ diffTarget: { sessionId, path } }),
  closeDiff: () => set({ diffTarget: null }),

  rejectDiff: async () => {
    const target = get().diffTarget
    if (!target) return
    const before = get().beforeByKey[keyOf(target.sessionId, target.path)]
    if (before !== undefined) {
      try {
        await window.lumixa.fs.writeFile(target.path, before)
        await reloadOpenTab(target.path)
      } catch {
        /* file may be gone; ignore */
      }
    }
    set({ diffTarget: null })
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
      // Capture the pre-edit content once, for the diff viewer. The tool_use
      // event that produced this fires *before* the edit runs, so reading disk
      // now yields the "before"; created files have no prior content.
      captureBefore(set, get, id, event.path)
      // If the file is open, reflect the on-disk change live.
      void reloadOpenTab(event.path)
      break
    }
    case 'permission-request':
      appendItem(set, id, { type: 'permission', tool: event.tool, detail: event.detail })
      break
    case 'error':
      appendItem(set, id, { type: 'error', friendly: event.friendly })
      maybeNotify(get, id, { error: true })
      break
    case 'completed':
      appendItem(set, id, { type: 'completed', result: event.result, costUsd: event.costUsd })
      if (typeof event.durationMs === 'number') useUsageStore.getState().addRuntime(event.durationMs)
      maybeNotify(get, id, { error: event.isError })
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

/** Toast a completion when the user isn't looking at this session (spec §15). */
function maybeNotify(get: () => AgentState, id: string, opts: { error: boolean }): void {
  const ui = useUiStore.getState()
  const state = get()
  const focused = ui.leftView === 'agent' && state.activeId === id
  if (focused) return
  const view = state.sessionsById[id]
  const title = view?.session.title ?? 'Claude Code'
  const n = view?.fileChanges.length ?? 0
  if (opts.error) {
    notify('error', `Claude Code stopped — ${title}`)
  } else {
    notify('success', n > 0 ? `✓ Claude Code finished — ${n} file(s) changed` : '✓ Claude Code finished')
  }
}

async function captureBefore(
  set: SetFn,
  get: () => AgentState,
  sessionId: string,
  path: string
): Promise<void> {
  const key = `${sessionId}::${path}`
  if (get().beforeByKey[key] !== undefined) return
  let before = ''
  try {
    before = await window.lumixa.fs.readFile(path)
  } catch {
    before = '' // created file — no prior content
  }
  set((s) =>
    s.beforeByKey[key] !== undefined
      ? {}
      : { beforeByKey: { ...s.beforeByKey, [key]: before } }
  )
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
