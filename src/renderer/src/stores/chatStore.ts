import { create } from 'zustand'
import type { ChatMessage, ProviderId } from '@shared/ipc'
import { useSettingsStore } from './settingsStore'

/**
 * Chat state. Holds the conversation, streams assistant tokens into the last
 * message, and tracks token usage for a (future) cost dashboard. The IPC
 * subscriptions are wired once via `init()` and route events by requestId.
 */
export interface DisplayMessage extends ChatMessage {
  id: string
  streaming?: boolean
}

interface ChatState {
  messages: DisplayMessage[]
  streaming: boolean
  activeRequestId: string | null
  lastUsage: { inputTokens?: number; outputTokens?: number } | null

  init: () => () => void
  send: (text: string) => Promise<void>
  cancel: () => void
  clear: () => void
}

const uid = (): string => Math.random().toString(36).slice(2) + Date.now().toString(36)

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streaming: false,
  activeRequestId: null,
  lastUsage: null,

  init: () => {
    const offDelta = window.lumixa.ai.onDelta(({ requestId, text }) => {
      if (get().activeRequestId !== requestId) return
      set((s) => ({
        messages: s.messages.map((m, i) =>
          i === s.messages.length - 1 && m.streaming
            ? { ...m, content: m.content + text }
            : m
        )
      }))
    })

    const finish = (): void =>
      set((s) => ({
        streaming: false,
        activeRequestId: null,
        messages: s.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m))
      }))

    const offDone = window.lumixa.ai.onDone(({ requestId, inputTokens, outputTokens }) => {
      if (get().activeRequestId !== requestId) return
      set({ lastUsage: { inputTokens, outputTokens } })
      finish()
    })

    const offError = window.lumixa.ai.onError(({ requestId, message }) => {
      if (get().activeRequestId !== requestId) return
      set((s) => ({
        messages: s.messages.map((m, i) =>
          i === s.messages.length - 1 && m.streaming
            ? { ...m, content: m.content + `\n\n⚠️ ${message}`, streaming: false }
            : m
        )
      }))
      finish()
    })

    return () => {
      offDelta()
      offDone()
      offError()
    }
  },

  send: async (text) => {
    const trimmed = text.trim()
    if (!trimmed || get().streaming) return

    const { selectedModel, models } = useSettingsStore.getState()
    if (!selectedModel) return
    const provider: ProviderId =
      models.find((m) => m.id === selectedModel)?.provider ?? 'anthropic'

    const requestId = uid()
    const userMsg: DisplayMessage = { id: uid(), role: 'user', content: trimmed }
    const assistantMsg: DisplayMessage = {
      id: uid(),
      role: 'assistant',
      content: '',
      streaming: true
    }

    // Build the API history (excludes the empty streaming placeholder).
    const history: ChatMessage[] = [...get().messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content
    }))

    set((s) => ({
      messages: [...s.messages, userMsg, assistantMsg],
      streaming: true,
      activeRequestId: requestId
    }))

    await window.lumixa.ai.startChat({
      requestId,
      provider,
      model: selectedModel,
      system:
        'You are Lumixa, an AI pair-programmer embedded in a code editor. Be concise and practical.',
      messages: history
    })
  },

  cancel: () => {
    const id = get().activeRequestId
    if (id) void window.lumixa.ai.cancelChat(id)
  },

  clear: () => set({ messages: [], lastUsage: null })
}))
