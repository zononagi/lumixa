import type { editor } from 'monaco-editor'
import type * as Monaco from 'monaco-editor'

/**
 * A tiny bridge that exposes the active Monaco editor + namespace to non-editor
 * features (Command Palette, Symbols, Why?, …) without coupling them to the
 * EditorArea component. EditorArea registers the instance on mount.
 */
interface ActiveEditor {
  editor: editor.IStandaloneCodeEditor
  monaco: typeof Monaco
}

let active: ActiveEditor | null = null
const listeners = new Set<() => void>()

export function setActiveEditor(editor: editor.IStandaloneCodeEditor, monaco: typeof Monaco): void {
  active = { editor, monaco }
  listeners.forEach((l) => l())
}

export function getActiveEditor(): ActiveEditor | null {
  return active
}

/** Subscribe to editor availability changes (e.g. first mount). */
export function onEditorChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Run a registered Monaco editor action by id (e.g. 'editor.action.formatDocument'). */
export function runEditorAction(actionId: string): boolean {
  const a = active?.editor.getAction(actionId)
  if (!a) return false
  void a.run()
  active?.editor.focus()
  return true
}
