import type { ChatMessage, CompleteResult, ProviderId } from '@shared/ipc'
import { useSettingsStore } from '@renderer/stores/settingsStore'

/**
 * Renderer-side helper for one-shot AI completions (Composer, Inline Edit).
 * Resolves the active provider/model from settings so callers just pass a
 * system prompt and a user message.
 */
export async function complete(system: string, user: string): Promise<CompleteResult> {
  const { selectedModel, models } = useSettingsStore.getState()
  if (!selectedModel) return { text: '', error: 'No model selected. Configure a provider in Settings.' }
  const provider: ProviderId =
    models.find((m) => m.id === selectedModel)?.provider ?? 'anthropic'
  const messages: ChatMessage[] = [{ role: 'user', content: user }]
  return window.lumixa.ai.complete({ provider, model: selectedModel, system, messages })
}
