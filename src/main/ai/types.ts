import type { ChatMessage, ModelInfo, ProviderId } from '@shared/ipc'

/**
 * Provider abstraction. Every LLM backend (Anthropic, OpenAI) implements
 * `AIProvider`, so adding a new backend is a single adapter file — the rest of
 * the app talks only to this interface.
 *
 * Providers run exclusively in the main process (they hold the OAuth access
 * token and use Node networking). The renderer never imports these.
 */

/** Resolved account credential passed to a provider at request time. */
export interface Credential {
  /** A currently-valid OAuth access token (already refreshed if needed). */
  token: string
  /** Provider-specific extras captured at login (e.g. ChatGPT account id). */
  meta?: Record<string, string>
}

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
   * List the models available for this provider given the linked account.
   * Returns [] when the provider is unreachable — callers treat an empty list
   * as "hide this provider".
   */
  listModels(cred: Credential): Promise<ModelInfo[]>

  /** Stream a chat completion. Resolves when the stream ends or errors. */
  streamChat(cred: Credential, params: ChatParams, handlers: StreamHandlers): Promise<void>
}
