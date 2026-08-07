import { create } from 'zustand'
import type { ModelInfo, ProviderId } from '@shared/ipc'

/**
 * Settings + model catalog. Tracks which providers have a key configured and
 * the list of available models (only reachable models appear). Per the spec,
 * unconfigured providers are hidden entirely from the model picker.
 */
interface SettingsState {
  configured: ProviderId[]
  models: ModelInfo[]
  selectedModel: string | null
  loadingModels: boolean

  refreshConfigured: () => Promise<void>
  saveKey: (provider: ProviderId, key: string) => Promise<void>
  refreshModels: () => Promise<void>
  selectModel: (id: string) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  configured: [],
  models: [],
  selectedModel: null,
  loadingModels: false,

  refreshConfigured: async () => {
    const configured = await window.lumixa.secrets.list()
    set({ configured })
  },

  saveKey: async (provider, key) => {
    await window.lumixa.secrets.set(provider, key)
    await get().refreshConfigured()
    await get().refreshModels()
  },

  refreshModels: async () => {
    set({ loadingModels: true })
    try {
      const models = await window.lumixa.ai.listModels()
      set((s) => ({
        models,
        // Keep the current selection if still valid, else pick the first model.
        selectedModel:
          s.selectedModel && models.some((m) => m.id === s.selectedModel)
            ? s.selectedModel
            : (models[0]?.id ?? null)
      }))
    } finally {
      set({ loadingModels: false })
    }
  },

  selectModel: (id) => set({ selectedModel: id })
}))
