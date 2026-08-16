import { create } from 'zustand'
import { useWorkspaceStore } from './workspaceStore'
import { useBrainStore } from './brainStore'

/**
 * Editor state: open tabs and the active tab. Each tab tracks its on-disk path,
 * current buffer content, and a dirty flag. Saving writes through the fs bridge.
 */
export interface EditorTab {
  path: string
  name: string
  content: string
  dirty: boolean
}

interface EditorState {
  tabs: EditorTab[]
  activePath: string | null

  openFile: (path: string, name: string) => Promise<void>
  setActive: (path: string) => void
  closeTab: (path: string) => void
  updateContent: (path: string, content: string) => void
  saveActive: () => Promise<void>
  /** Reflect an on-disk write (e.g. from Composer) into an open tab, if any. */
  setSavedContent: (path: string, content: string) => void
}

const langFromName = (name: string): string => name // reserved for future Monaco language mapping

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activePath: null,

  openFile: async (path, name) => {
    const existing = get().tabs.find((t) => t.path === path)
    if (existing) {
      set({ activePath: path })
      return
    }
    const content = await window.lumixa.fs.readFile(path)
    void langFromName(name)
    set((s) => ({
      tabs: [...s.tabs, { path, name, content, dirty: false }],
      activePath: path
    }))
  },

  setActive: (path) => set({ activePath: path }),

  closeTab: (path) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.path !== path)
      const activePath =
        s.activePath === path ? (tabs.length ? tabs[tabs.length - 1].path : null) : s.activePath
      return { tabs, activePath }
    }),

  updateContent: (path, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === path ? { ...t, content, dirty: true } : t
      )
    })),

  saveActive: async () => {
    const { activePath, tabs } = get()
    const tab = tabs.find((t) => t.path === activePath)
    if (!tab) return
    await window.lumixa.fs.writeFile(tab.path, tab.content)
    set((s) => ({
      tabs: s.tabs.map((t) => (t.path === tab.path ? { ...t, dirty: false } : t))
    }))
    // Keep the Project Brain current with the saved file (debounced).
    const root = useWorkspaceStore.getState().root
    if (root) useBrainStore.getState().touchFile(root, tab.path)
  },

  setSavedContent: (path, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.path === path ? { ...t, content, dirty: false } : t))
    }))
}))
