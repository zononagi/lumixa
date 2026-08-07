import { create } from 'zustand'
import type { DirEntry } from '@shared/ipc'

/**
 * Workspace state: the opened root folder and the lazily-loaded directory tree.
 * The tree is a flat map keyed by path; each directory caches its children so
 * the Explorer can expand/collapse without re-reading disk.
 */
interface WorkspaceState {
  root: string | null
  rootName: string | null
  childrenByPath: Record<string, DirEntry[]>
  expanded: Set<string>
  /** Project Memory: auto-loaded context (README/CLAUDE/AGENTS/package.json…). */
  projectContext: string

  openFolder: () => Promise<void>
  toggleDir: (path: string) => Promise<void>
  loadChildren: (path: string) => Promise<void>
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  root: null,
  rootName: null,
  childrenByPath: {},
  expanded: new Set(),
  projectContext: '',

  openFolder: async () => {
    const result = await window.lumixa.fs.openFolder()
    if (!result) return
    set({
      root: result.root,
      rootName: result.name,
      childrenByPath: {},
      expanded: new Set(),
      projectContext: ''
    })
    await get().loadChildren(result.root)
    // Load Project Memory in the background so the AI knows the project.
    void window.lumixa.project.context(result.root).then((ctx) => set({ projectContext: ctx }))
  },

  loadChildren: async (path) => {
    if (get().childrenByPath[path]) return
    const entries = await window.lumixa.fs.readDir(path)
    set((s) => ({ childrenByPath: { ...s.childrenByPath, [path]: entries } }))
  },

  toggleDir: async (path) => {
    const expanded = new Set(get().expanded)
    if (expanded.has(path)) {
      expanded.delete(path)
    } else {
      expanded.add(path)
      await get().loadChildren(path)
    }
    set({ expanded })
  }
}))
