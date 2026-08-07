import Anthropic from '@anthropic-ai/sdk'
import type { ModelInfo } from '@shared/ipc'
import type { AIProvider, ChatParams, Credential, StreamHandlers } from './types'

/**
 * Anthropic adapter — uses the Claude subscription OAuth token (Claude Pro/Max),
 * not an API key. The token is sent as a Bearer credential with the OAuth beta
 * header; no `x-api-key` is set.
 *
 * The subscription (Claude Code) OAuth grant expects requests to identify as
 * Claude Code — the first system block must state that identity, otherwise the
 * inference endpoint rejects the request. We prepend it and keep the caller's
 * own system prompt as a second block.
 */

const CLAUDE_CODE_IDENTITY = "You are Claude Code, Anthropic's official CLI for Claude."
const OAUTH_BETA = 'oauth-2025-04-20'

// Models available under the subscription grant. (The Models API isn't reachable
// with an OAuth inference token, so this list is static and easy to update.)
const MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-8', displayName: 'Claude Opus 4.8', provider: 'anthropic' },
  { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', provider: 'anthropic' },
  { id: 'claude-haiku-4-5', displayName: 'Claude Haiku 4.5', provider: 'anthropic' }
]

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic' as const

  private client(token: string): Anthropic {
    // `authToken` sets `Authorization: Bearer …` and omits `x-api-key`.
    return new Anthropic({ authToken: token, defaultHeaders: { 'anthropic-beta': OAUTH_BETA } })
  }

  async listModels(_cred: Credential): Promise<ModelInfo[]> {
    return MODELS
  }

  async streamChat(cred: Credential, params: ChatParams, handlers: StreamHandlers): Promise<void> {
    const client = this.client(cred.token)
    try {
      const system = [
        { type: 'text' as const, text: CLAUDE_CODE_IDENTITY },
        ...(params.system ? [{ type: 'text' as const, text: params.system }] : [])
      ]

      const stream = client.messages.stream(
        {
          model: params.model,
          max_tokens: 8192,
          system,
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
        handlers.onDone()
        return
      }
      handlers.onError(err instanceof Error ? err.message : String(err))
    }
  }
}
