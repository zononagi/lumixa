import Anthropic from '@anthropic-ai/sdk'
import type { ModelInfo } from '@shared/ipc'
import type { AIProvider, ChatParams, StreamHandlers } from './types'

/**
 * Anthropic adapter. Streams via the SDK's `messages.stream` helper and
 * forwards text deltas through the handler callbacks. Model discovery uses the
 * live Models API so only models the key can actually reach are surfaced.
 */

// Fallback list used when the Models API can't be reached but the key is set.
const FALLBACK_MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-8', displayName: 'Claude Opus 4.8', provider: 'anthropic' },
  { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', provider: 'anthropic' },
  { id: 'claude-haiku-4-5', displayName: 'Claude Haiku 4.5', provider: 'anthropic' }
]

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic' as const

  private client(apiKey: string): Anthropic {
    return new Anthropic({ apiKey })
  }

  async listModels(apiKey: string): Promise<ModelInfo[]> {
    try {
      const client = this.client(apiKey)
      const models: ModelInfo[] = []
      for await (const m of client.models.list()) {
        models.push({
          id: m.id,
          displayName: m.display_name ?? m.id,
          provider: 'anthropic'
        })
      }
      return models.length > 0 ? models : FALLBACK_MODELS
    } catch {
      return FALLBACK_MODELS
    }
  }

  async streamChat(
    apiKey: string,
    params: ChatParams,
    handlers: StreamHandlers
  ): Promise<void> {
    const client = this.client(apiKey)
    try {
      const stream = client.messages.stream(
        {
          model: params.model,
          max_tokens: 8192,
          system: params.system,
          messages: params.messages.map((m) => ({ role: m.role, content: m.content }))
        },
        { signal: handlers.signal }
      )

      stream.on('text', (delta) => handlers.onDelta(delta))

      const final = await stream.finalMessage()
      handlers.onDone({
        inputTokens: final.usage?.input_tokens,
        outputTokens: final.usage?.output_tokens
      })
    } catch (err) {
      if (handlers.signal.aborted) {
        // Cancellation is not an error condition.
        handlers.onDone()
        return
      }
      handlers.onError(err instanceof Error ? err.message : String(err))
    }
  }
}
