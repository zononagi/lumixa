import type { ModelInfo } from '@shared/ipc'
import type { AIProvider, ChatParams, Credential, StreamHandlers } from './types'

/**
 * OpenAI adapter — uses the ChatGPT subscription OAuth token (the "Sign in with
 * ChatGPT" flow used by Codex), not an API key. Requests go to the ChatGPT
 * backend Codex responses endpoint with the account id captured at login.
 *
 * This mirrors the Codex CLI's request shape. The endpoint and payload are the
 * parts most likely to drift over time — if OpenAI changes them, this file is
 * the single place to update.
 */

const RESPONSES_URL = 'https://chatgpt.com/backend-api/codex/responses'

const MODELS: ModelInfo[] = [
  { id: 'gpt-5', displayName: 'GPT-5', provider: 'openai' },
  { id: 'gpt-5-codex', displayName: 'GPT-5 Codex', provider: 'openai' }
]

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const

  async listModels(_cred: Credential): Promise<ModelInfo[]> {
    return MODELS
  }

  async streamChat(cred: Credential, params: ChatParams, handlers: StreamHandlers): Promise<void> {
    const accountId = cred.meta?.chatgptAccountId
    try {
      // Responses API input: prior turns as typed message items.
      const input = params.messages.map((m) => ({
        type: 'message' as const,
        role: m.role,
        content: [
          {
            type: m.role === 'assistant' ? ('output_text' as const) : ('input_text' as const),
            text: m.content
          }
        ]
      }))

      const res = await fetch(RESPONSES_URL, {
        method: 'POST',
        signal: handlers.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${cred.token}`,
          ...(accountId ? { 'chatgpt-account-id': accountId } : {}),
          'openai-beta': 'responses=experimental'
        },
        body: JSON.stringify({
          model: params.model,
          instructions: params.system,
          input,
          stream: true,
          store: false
        })
      })

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '')
        throw new Error(`OpenAI returned ${res.status}: ${text.slice(0, 300)}`)
      }

      await this.pump(res.body, handlers)
    } catch (err) {
      if (handlers.signal.aborted) {
        handlers.onDone()
        return
      }
      handlers.onError(err instanceof Error ? err.message : String(err))
    }
  }

  /** Parse the SSE stream, forwarding text deltas and final usage. */
  private async pump(body: ReadableStream<Uint8Array>, handlers: StreamHandlers): Promise<void> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let usage: { inputTokens?: number; outputTokens?: number } | undefined

    const handleEvent = (raw: string): void => {
      // Each SSE block may carry multiple `data:` lines.
      const dataLines = raw
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
      if (dataLines.length === 0) return
      const payload = dataLines.join('')
      if (!payload || payload === '[DONE]') return

      try {
        const evt = JSON.parse(payload) as {
          type?: string
          delta?: string
          response?: { usage?: { input_tokens?: number; output_tokens?: number } }
        }
        if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') {
          handlers.onDelta(evt.delta)
        } else if (evt.type === 'response.completed') {
          usage = {
            inputTokens: evt.response?.usage?.input_tokens,
            outputTokens: evt.response?.usage?.output_tokens
          }
        }
      } catch {
        // Ignore non-JSON keep-alive lines.
      }
    }

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // SSE events are separated by a blank line.
      let idx: number
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        handleEvent(buffer.slice(0, idx))
        buffer = buffer.slice(idx + 2)
      }
    }
    if (buffer.trim()) handleEvent(buffer)

    handlers.onDone(usage)
  }
}
