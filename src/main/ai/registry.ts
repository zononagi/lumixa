import type { ProviderId } from '@shared/ipc'
import type { AIProvider } from './types'
import { AnthropicProvider } from './anthropic'

/**
 * Provider registry. Phase 1 ships Anthropic; OpenAI / Gemini / OpenRouter /
 * Ollama slot in here as additional adapters with no other code changes.
 */
const providers = new Map<ProviderId, AIProvider>([['anthropic', new AnthropicProvider()]])

export function getProvider(id: ProviderId): AIProvider | undefined {
  return providers.get(id)
}

export function registeredProviderIds(): ProviderId[] {
  return [...providers.keys()]
}
