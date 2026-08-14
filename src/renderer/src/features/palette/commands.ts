import { useUiStore } from '@renderer/stores/uiStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useGitStore } from '@renderer/stores/gitStore'
import { useAppearanceStore } from '@renderer/stores/appearanceStore'
import { useExperienceStore } from '@renderer/stores/experienceStore'
import { getActiveEditor, runEditorAction } from '@renderer/lib/editorBridge'
import { explainApi, explainError } from '@renderer/features/intelligence/knowledgeBase'
import { useI18nStore } from '@renderer/i18n'

export interface Command {
  id: string
  title: string
  category: string
  run: () => void
}

/** Compose the current cursor's "Why?" explanation from static analysis. */
export function explainAtCursor(): string {
  const active = getActiveEditor()
  if (!active) return 'Open a file first.'
  const { editor, monaco } = active
  const model = editor.getModel()
  const pos = editor.getPosition()
  if (!model || !pos) return 'No active position.'
  const locale = useI18nStore.getState().locale === 'ja' ? 'ja' : 'en'
  const out: string[] = []

  const word = model.getWordAtPosition(pos)?.word
  const api = word ? explainApi(word) : undefined
  if (api) out.push(`📘 ${word} — ${api[locale]}`)

  for (const m of monaco.editor.getModelMarkers({ resource: model.uri })) {
    if (m.startLineNumber <= pos.lineNumber && m.endLineNumber >= pos.lineNumber) {
      out.push(`⚠️ ${m.message}`)
      const err = explainError(typeof m.code === 'object' ? m.code?.value : m.code)
      if (err) out.push(`💡 ${err[locale]}`)
    }
  }

  if (out.length === 0) {
    return locale === 'ja'
      ? 'この位置に説明できる情報はありません。'
      : 'No static explanation available for this position.'
  }
  return out.join('\n\n')
}

async function blameCurrentLine(): Promise<void> {
  const active = getActiveEditor()
  const root = useWorkspaceStore.getState().root
  const path = useEditorStore.getState().activePath
  const line = active?.editor.getPosition()?.lineNumber
  const ui = useUiStore.getState()
  if (!root || !path || !line) {
    ui.setWhy('Open a file inside a Git repository first.')
    return
  }
  const result = await window.lumixa.git.blame(root, path, line)
  ui.setWhy(`git blame · L${line}\n\n${result}`)
}

/** The full command set surfaced in the Command Palette. */
export function buildCommands(): Command[] {
  const ui = useUiStore.getState
  const ws = useWorkspaceStore.getState
  const ed = useEditorStore.getState
  const git = useGitStore.getState
  const appearance = useAppearanceStore.getState
  const xp = useExperienceStore.getState

  const openWhatsNext = (): void => {
    ui().setTerminal(true)
    ui().setBottomTab('whatsnext')
  }

  return [
    // "No Dead Ends" escape hatches (spec §77, §78) — always a way forward.
    { id: 'help.whatsNext', title: "What's Next?", category: 'Help', run: openWhatsNext },
    { id: 'help.lost', title: "I don't know what to do", category: 'Help', run: openWhatsNext },

    { id: 'mode.beginner', title: 'Experience Mode: Beginner', category: 'Mode', run: () => xp().setMode('beginner') },
    { id: 'mode.developer', title: 'Experience Mode: Developer', category: 'Mode', run: () => xp().setMode('developer') },
    { id: 'mode.expert', title: 'Experience Mode: Expert', category: 'Mode', run: () => xp().setMode('expert') },

    { id: 'workspace.openFolder', title: 'Open Folder…', category: 'File', run: () => void ws().openFolder() },
    { id: 'file.save', title: 'Save File', category: 'File', run: () => void ed().saveActive() },

    { id: 'view.explorer', title: 'View: Explorer', category: 'View', run: () => ui().setLeftView('explorer') },
    { id: 'view.git', title: 'View: Source Control', category: 'View', run: () => ui().setLeftView('git') },
    { id: 'view.health', title: 'View: Project Health', category: 'View', run: () => ui().setLeftView('health') },
    { id: 'view.safe', title: 'View: Safe Mode (Snapshots)', category: 'View', run: () => ui().setLeftView('safe') },
    { id: 'view.settings', title: 'View: Settings', category: 'View', run: () => ui().setLeftView('settings') },
    { id: 'terminal.toggle', title: 'Toggle Terminal', category: 'View', run: () => ui().toggleTerminal() },
    {
      id: 'problems.show',
      title: 'Show Problems',
      category: 'View',
      run: () => {
        ui().setTerminal(true)
        ui().setBottomTab('problems')
      }
    },

    { id: 'editor.format', title: 'Format Document', category: 'Editor', run: () => runEditorAction('editor.action.formatDocument') },
    { id: 'editor.organizeImports', title: 'Organize Imports', category: 'Editor', run: () => runEditorAction('editor.action.organizeImports') },
    { id: 'editor.quickOutline', title: 'Go to Symbol in File…', category: 'Editor', run: () => runEditorAction('editor.action.quickOutline') },
    { id: 'editor.gotoDefinition', title: 'Go to Definition', category: 'Editor', run: () => runEditorAction('editor.action.revealDefinition') },
    { id: 'editor.findReferences', title: 'Find References', category: 'Editor', run: () => runEditorAction('editor.action.goToReferences') },
    { id: 'editor.rename', title: 'Rename Symbol', category: 'Editor', run: () => runEditorAction('editor.action.rename') },
    { id: 'editor.quickFix', title: 'Quick Fix…', category: 'Editor', run: () => runEditorAction('editor.action.quickFix') },

    { id: 'why.explain', title: 'Why? (explain cursor / errors)', category: 'Learn', run: () => ui().setWhy(explainAtCursor()) },

    {
      id: 'safe.snapshot',
      title: 'Safe Mode: Create Snapshot',
      category: 'Safe Mode',
      run: () => {
        const r = ws().root
        if (!r) return
        ui().setLeftView('safe')
        void window.lumixa.snapshot.create(r, '')
      }
    },

    { id: 'git.refresh', title: 'Git: Refresh', category: 'Git', run: () => void git().refresh() },
    { id: 'git.push', title: 'Git: Push', category: 'Git', run: () => void git().push() },
    { id: 'git.pull', title: 'Git: Pull', category: 'Git', run: () => void git().pull() },
    { id: 'git.stash', title: 'Git: Stash', category: 'Git', run: () => void git().stash() },
    { id: 'git.stashPop', title: 'Git: Stash Pop', category: 'Git', run: () => void git().stashPop() },
    { id: 'git.history', title: 'Git: Show History', category: 'Git', run: () => { ui().setLeftView('git'); void git().loadHistory() } },
    { id: 'git.blame', title: 'Git: Blame Current Line', category: 'Git', run: () => void blameCurrentLine() },

    { id: 'theme.dark', title: 'Theme: Dark', category: 'Appearance', run: () => appearance().setMode('dark') },
    { id: 'theme.light', title: 'Theme: Light', category: 'Appearance', run: () => appearance().setMode('light') }
  ]
}
