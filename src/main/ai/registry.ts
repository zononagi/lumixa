import type { ProviderId } from '@shared/ipc'
import type { AIProvider } from './types'
import { AnthropicProvider } from './anthropic'
import { OpenAIProvider } from './openai'

/**
 * Provider registry. Both backends authenticate via account linking (OAuth);
 * new adapters slot in here with no other code changes.
 */
const providers = new Map<ProviderId, AIProvider>([
  ['anthropic', new AnthropicProvider()],
  ['openai', new OpenAIProvider()]
])

export function getProvider(id: ProviderId): AIProvider | undefined {
  return providers.get(id)
}

export function registeredProviderIds(): ProviderId[] {
  return [...providers.keys()]
}
