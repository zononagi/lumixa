import { create } from 'zustand'
import { useWorkspaceStore } from './workspaceStore'
import { useBrainStore } from './brainStore'
import { useAgentStore } from './agentStore'
import { useUiStore } from './uiStore'
import { useMarkersStore } from '@renderer/features/problems/markersStore'
import { notify } from './notifyStore'
import {
  buildInvestigationPrompt,
  extractKeywords,
  relatedFiles,
  type BugEvidence
} from '@renderer/features/bug/bugDetective'

/**
 * Bug Detective store (spec §15-§17). Collects deterministic evidence from
 * Lumixa's own data, then routes the investigation to Claude Code. Lumixa never
 * invents hypotheses or confidence numbers — those come from the CLI.
 */
interface BugState {
  description: string
  evidence: BugEvidence | null
  gathering: boolean

  setDescription: (d: string) => void
  gather: () => Promise<BugEvidence | null>
  investigate: () => Promise<void>
  clear: () => void
}

export const useBugStore = create<BugState>((set, get) => ({
  description: '',
  evidence: null,
  gathering: false,

  setDescription: (description) => set({ description }),

  gather: async () => {
    const root = useWorkspaceStore.getState().root
    const desc = get().description.trim()
    if (!root || !desc) return null
    set({ gathering: true })
    try {
      const keywords = extractKeywords(desc)
      const brain = useBrainStore.getState().brain
      const related = relatedFiles(brain?.files ?? [], keywords)

      let recentCommits: string[] = []
      let diff = ''
      try {
        recentCommits = await window.lumixa.git.log(root)
      } catch {
        /* not a repo */
      }
      try {
        diff = await window.lumixa.git.workingDiff(root)
      } catch {
        /* ignore */
      }

      const problems = useMarkersStore
        .getState()
        .problems.slice(0, 20)
        .map((p) => ({ path: p.path, line: p.line, message: p.message, severity: p.severity }))

      const evidence: BugEvidence = {
        keywords,
        recentCommits,
        hasUncommitted: diff.trim().length > 0,
        diffSnippet: diff.length > 6000 ? diff.slice(0, 6000) + '\n…(truncated)' : diff,
        problems,
        summary: brain?.summary ?? null,
        relatedFiles: related
      }
      set({ evidence, gathering: false })
      return evidence
    } catch {
      set({ gathering: false })
      return null
    }
  },

  investigate: async () => {
    const desc = get().description.trim()
    if (!desc) {
      notify('info', 'Describe the bug first.')
      return
    }
    const evidence = await get().gather()
    if (!evidence) {
      notify('warn', 'Open a folder to investigate.')
      return
    }
    const agent = useAgentStore.getState()
    const claude = agent.providers.some(
      (p) => p.id === 'claude-code' && p.state === 'authenticated'
    )
    if (!claude) {
      notify('warn', 'Claude Code is needed for the analysis — the evidence above is still shown.')
      return
    }
    const id = await agent.createSession('claude-code')
    if (!id) return
    void agent.rename(id, `Bug: ${desc.slice(0, 40)}`)
    useUiStore.getState().setLeftView('agent')
    await agent.send(id, buildInvestigationPrompt(desc, evidence))
  },

  clear: () => set({ description: '', evidence: null })
}))
