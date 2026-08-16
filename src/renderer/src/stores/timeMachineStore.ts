import { create } from 'zustand'
import type { BlameInfo, CommitInfo } from '@shared/ipc'
import { useWorkspaceStore } from './workspaceStore'
import { useEditorStore } from './editorStore'
import { useAgentStore } from './agentStore'
import { useUiStore } from './uiStore'
import { notify } from './notifyStore'
import { getActiveEditor } from '@renderer/lib/editorBridge'
import { buildWhyPrompt } from '@renderer/features/timemachine/timeMachine'

/**
 * Git Time Machine store (spec §25-§26). Inspects a line's git origin (blame →
 * introducing commit), loads a file's history, and hands the "why does this
 * exist?" question to Claude Code with the git evidence attached. The
 * explanation comes from Claude — Lumixa only supplies verifiable git facts.
 */
interface TimeMachineState {
  file: string | null
  line: number | null
  blame: BlameInfo | null
  commit: CommitInfo | null
  history: string[]
  loading: boolean
  error: string | null

  inspect: () => Promise<void>
  explain: () => Promise<void>
  clear: () => void
}

export const useTimeMachineStore = create<TimeMachineState>((set, get) => ({
  file: null,
  line: null,
  blame: null,
  commit: null,
  history: [],
  loading: false,
  error: null,

  inspect: async () => {
    const root = useWorkspaceStore.getState().root
    const file = useEditorStore.getState().activePath
    const line = getActiveEditor()?.editor.getPosition()?.lineNumber ?? 1
    if (!root || !file) {
      set({ error: 'Open a file inside a Git repository first.' })
      return
    }
    set({ loading: true, error: null, file, line, blame: null, commit: null, history: [] })
    try {
      const [blame, history] = await Promise.all([
        window.lumixa.git.blameInfo(root, file, line),
        window.lumixa.git.fileLog(root, file)
      ])
      let commit: CommitInfo | null = null
      if (blame) commit = await window.lumixa.git.commitShow(root, blame.hash)
      set({
        blame,
        commit,
        history,
        loading: false,
        error: blame ? null : 'This line has no committed history yet (uncommitted or not a repo).'
      })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Git lookup failed' })
    }
  },

  explain: async () => {
    const { file, line, blame, commit, history } = get()
    if (!file || !line || !blame) {
      notify('info', 'Inspect a line first.')
      return
    }
    const agent = useAgentStore.getState()
    const claude = agent.providers.some((p) => p.id === 'claude-code' && p.state === 'authenticated')
    if (!claude) {
      notify('warn', 'Claude Code is needed to explain the history.')
      return
    }
    const name = file.split(/[\\/]/).pop() ?? file
    const id = await agent.createSession('claude-code')
    if (!id) return
    void agent.rename(id, `Why: ${name}:${line}`)
    useUiStore.getState().setLeftView('agent')
    await agent.send(id, buildWhyPrompt(name, line, blame, commit, history))
  },

  clear: () =>
    set({ file: null, line: null, blame: null, commit: null, history: [], error: null })
}))
