import type { ChatMessage, ModelInfo, ProviderId } from '@shared/ipc'

/**
 * Provider abstraction. Every LLM backend (Anthropic, OpenAI) implements
 * `AIProvider`, so adding a new backend is a single adapter file — the rest of
 * the app talks only to this interface.
 *
 * Providers run exclusively in the main process (they hold the API key and use
 * Node networking). The renderer never imports these.
 */

export interface StreamHandlers {
  onDelta: (text: string) => void
  onDone: (usage?: { inputTokens?: number; outputTokens?: number }) => void
  onError: (message: string) => void
  /** Resolves true if the caller has requested cancellation. */
  signal: AbortSignal
}

export interface ChatParams {
  model: string
  system?: string
  messages: ChatMessage[]
}

export interface AIProvider {
  readonly id: ProviderId

  /**
   * List the models actually available for this provider given the configured
   * key. Returns [] when the provider is unreachable or unconfigured — callers
   * treat an empty list as "hide this provider".
   */
  listModels(apiKey: string): Promise<ModelInfo[]>

  /** Stream a chat completion. Resolves when the stream ends or errors. */
  streamChat(apiKey: string, params: ChatParams, handlers: StreamHandlers): Promise<void>
}
