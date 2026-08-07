import { create } from 'zustand'
import type { AuthAccount, LoginResult, ModelInfo, ProviderId } from '@shared/ipc'

/**
 * Settings + model catalog. Tracks which providers are linked (OAuth account
 * connected) and the list of available models. Per the spec, providers that
 * aren't signed in are hidden entirely from the model picker.
 */
interface SettingsState {
  accounts: AuthAccount[]
  models: ModelInfo[]
  selectedModel: string | null
  loadingModels: boolean

  refreshAuth: () => Promise<void>
  login: (provider: ProviderId) => Promise<LoginResult>
  submitCode: (provider: ProviderId, code: string) => Promise<void>
  logout: (provider: ProviderId) => Promise<void>
  refreshModels: () => Promise<void>
  selectModel: (id: string) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  accounts: [],
  models: [],
  selectedModel: null,
  loadingModels: false,

  refreshAuth: async () => {
    const accounts = await window.lumixa.auth.status()
    set({ accounts })
  },

  login: async (provider) => {
    const result = await window.lumixa.auth.login(provider)
    // Loopback providers finish here; refresh once they're linked.
    if (result.ok && !result.needsCode) {
      await get().refreshAuth()
      await get().refreshModels()
    }
    return result
  },

  submitCode: async (provider, code) => {
    const result = await window.lumixa.auth.submitCode(provider, code)
    if (!result.ok) throw new Error(result.error ?? 'Sign-in failed.')
    await get().refreshAuth()
    await get().refreshModels()
  },

  logout: async (provider) => {
    await window.lumixa.auth.logout(provider)
    await get().refreshAuth()
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
