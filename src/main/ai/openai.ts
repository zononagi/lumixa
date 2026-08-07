import type { ModelInfo } from '@shared/ipc'
import type { AIProvider, ChatParams, StreamHandlers } from './types'

/**
 * OpenAI adapter. Uses a standard OpenAI API key (platform.openai.com) against
 * the Chat Completions API with SSE streaming. ChatGPT-subscription OAuth is
 * intentionally not used — it's locked to OpenAI's own apps (Codex/ChatGPT).
 */

const BASE = 'https://api.openai.com/v1'

// Shown when the Models API can't be reached but a key is set.
const FALLBACK_MODELS: ModelInfo[] = [
  { id: 'gpt-4o', displayName: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', displayName: 'GPT-4o mini', provider: 'openai' },
  { id: 'gpt-4.1', displayName: 'GPT-4.1', provider: 'openai' }
]

/** Parse one SSE block's `data:` lines into text deltas. */
export function parseOpenAIStreamChunk(chunk: string): string[] {
  return chunk
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim())
    .filter((d) => d && d !== '[DONE]')
    .map((d) => {
      try {
        const parsed = JSON.parse(d) as { choices?: { delta?: { content?: string } }[] }
        return parsed.choices?.[0]?.delta?.content ?? ''
      } catch {
        return ''
      }
    })
    .filter((s) => s.length > 0)
}

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const

  async listModels(apiKey: string): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${BASE}/models`, {
        headers: { authorization: `Bearer ${apiKey}` }
      })
      if (!res.ok) return FALLBACK_MODELS
      const json = (await res.json()) as { data?: { id?: string }[] }
      const models = (json.data ?? [])
        .map((m) => m.id)
        .filter((id): id is string => typeof id === 'string')
        // Chat-capable families only; drop embeddings/audio/image/moderation.
        .filter(
          (id) =>
            /^(gpt-|o\d|chatgpt)/.test(id) &&
            !/embedding|audio|realtime|image|tts|whisper|moderation/.test(id)
        )
        .sort()
        .map((id) => ({ id, displayName: id, provider: 'openai' as const }))
      return models.length > 0 ? models : FALLBACK_MODELS
    } catch {
      return FALLBACK_MODELS
    }
  }

  async streamChat(apiKey: string, params: ChatParams, handlers: StreamHandlers): Promise<void> {
    try {
      const messages = [
        ...(params.system ? [{ role: 'system' as const, content: params.system }] : []),
        ...params.messages.map((m) => ({ role: m.role, content: m.content }))
      ]

      const res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        signal: handlers.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model: params.model, messages, stream: true })
      })

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '')
        throw new Error(`OpenAI returned ${res.status}: ${text.slice(0, 300)}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let idx: number
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          for (const delta of parseOpenAIStreamChunk(buffer.slice(0, idx))) handlers.onDelta(delta)
          buffer = buffer.slice(idx + 2)
        }
      }
      if (buffer.trim()) for (const delta of parseOpenAIStreamChunk(buffer)) handlers.onDelta(delta)

      handlers.onDone()
    } catch (err) {
      if (handlers.signal.aborted) {
        handlers.onDone()
        return
      }
      handlers.onError(err instanceof Error ? err.message : String(err))
    }
  }
}
