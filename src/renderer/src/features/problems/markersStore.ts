import { create } from 'zustand'
import type * as Monaco from 'monaco-editor'

/**
 * Problems — mirrors Monaco's diagnostics (markers) into a store so the bottom
 * "Problems" tab can list them and jump to the source. Fed by a global
 * onDidChangeMarkers watcher installed from monacoSetup.
 */
export interface Problem {
  resource: string // model uri as string
  path: string // friendly file name
  line: number
  column: number
  message: string
  severity: number // 8=error, 4=warning, 2=info, 1=hint (Monaco MarkerSeverity)
  code?: string
}

interface MarkersState {
  problems: Problem[]
  set: (p: Problem[]) => void
}

export const useMarkersStore = create<MarkersState>((set) => ({
  problems: [],
  set: (problems) => set({ problems })
}))

let installed = false

export function installMarkersWatcher(monaco: typeof Monaco): void {
  if (installed) return
  installed = true

  const refresh = (): void => {
    const all = monaco.editor.getModelMarkers({})
    const problems: Problem[] = all
      .filter((m) => m.severity >= 4) // errors + warnings
      .map((m) => {
        const uri = m.resource.toString()
        const path = m.resource.path.split('/').pop() ?? uri
        return {
          resource: uri,
          path,
          line: m.startLineNumber,
          column: m.startColumn,
          message: m.message,
          severity: m.severity,
          code: typeof m.code === 'object' ? m.code?.value : m.code
        }
      })
      .sort((a, b) => b.severity - a.severity || a.path.localeCompare(b.path) || a.line - b.line)
    useMarkersStore.getState().set(problems)
  }

  monaco.editor.onDidChangeMarkers(refresh)
  refresh()
}
