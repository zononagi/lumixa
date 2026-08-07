import type { ModelInfo } from '@shared/ipc'
import type { AIProvider, ChatParams, StreamHandlers } from './types'

export function parseOpenAIStreamChunk(chunk: string): string[] {
  return chunk
    .split('\n\n')
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const lines = part.split('\n').filter(Boolean)
      const dataLines = lines.filter((line) => line.startsWith('data:'))
      if (dataLines.length === 0) return []

      return dataLines
        .map((line) => line.slice(5).trim())
        .filter((data) => data && data !== '[DONE]')
        .map((data) => {
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }> | undefined
            }
            return parsed.choices?.[0]?.delta?.content ?? ''
          } catch {
            return ''
          }
        })
        .filter((delta) => delta.length > 0)
    })
}

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const

  private async request<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`https://api.openai.com/v1/${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(init?.headers ?? {})
      }
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(`OpenAI API error (${response.status}): ${message}`)
    }

    return (await response.json()) as T
  }

  async listModels(apiKey: string): Promise<ModelInfo[]> {
    try {
      const data = await this.request<{ data?: Array<{ id?: string; display_name?: string }> }>(
        apiKey,
        'models'
      )
      const models: ModelInfo[] = (data.data ?? [])
        .filter((model) => typeof model.id === 'string')
        .map((model) => ({
          id: model.id as string,
          displayName: model.display_name ?? (model.id as string),
          provider: 'openai'
        }))
      return models.length > 0 ? models : []
    } catch {
      return []
    }
  }

  async streamChat(
    apiKey: string,
    params: ChatParams,
    handlers: StreamHandlers
  ): Promise<void> {
    if (handlers.signal.aborted) return

    const requestBody = {
      model: params.model,
      stream: true,
      messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
      ...(params.system ? { system: params.system } : {})
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: handlers.signal
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(`OpenAI API error (${response.status}): ${message}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('OpenAI stream is unavailable')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const deltas = parseOpenAIStreamChunk(part)
          for (const delta of deltas) {
            handlers.onDelta(delta)
          }
        }
      }

      if (buffer.trim()) {
        const deltas = parseOpenAIStreamChunk(buffer)
        for (const delta of deltas) {
          handlers.onDelta(delta)
        }
      }

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
