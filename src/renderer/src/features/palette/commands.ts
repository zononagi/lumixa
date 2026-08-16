import { useUiStore } from '@renderer/stores/uiStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useGitStore } from '@renderer/stores/gitStore'
import { useAppearanceStore } from '@renderer/stores/appearanceStore'
import { useExperienceStore } from '@renderer/stores/experienceStore'
import { useAgentStore } from '@renderer/stores/agentStore'
import { useBrainStore } from '@renderer/stores/brainStore'
import { useHealStore } from '@renderer/stores/healStore'
import { useTestGuardianStore } from '@renderer/stores/testGuardianStore'
import { notify } from '@renderer/stores/notifyStore'
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

/** Current editor selection text, or '' if nothing is selected. */
function selectionText(): string {
  const active = getActiveEditor()
  const sel = active?.editor.getSelection()
  if (!active || !sel) return ''
  return active.editor.getModel()?.getValueInRange(sel) ?? ''
}

/** Selection action (spec §28, §79): hand the selected code to Claude Code as a
 *  chat shortcut. Lumixa's own static help stays available without it. */
async function askClaudeAboutSelection(): Promise<void> {
  const code = selectionText().trim()
  const path = useEditorStore.getState().activePath
  const ja = useI18nStore.getState().locale === 'ja'
  if (!code || !path) {
    notify('info', ja ? 'まずコードを選択してください。' : 'Select some code first.')
    return
  }
  const agent = useAgentStore.getState()
  useUiStore.getState().setLeftView('agent')
  await agent.refreshProviders()
  const claude = agent.providers.find((p) => p.id === 'claude-code' && p.state === 'authenticated')
  if (!claude) {
    notify('warn', ja ? 'Claude Code が利用できません（未インストール/未ログイン）。' : 'Claude Code is not available (not installed / signed in).')
    return
  }
  const id = await agent.createSession('claude-code')
  if (!id) return
  agent.setActive(id)
  const fileName = path.split(/[\\/]/).pop()
  await agent.send(id, `Explain this code from ${fileName}:\n\n\`\`\`\n${code}\n\`\`\``)
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
    { id: 'view.brain', title: 'View: Project Brain', category: 'View', run: () => ui().setLeftView('brain') },
    { id: 'view.watcher', title: 'View: AI Code Watcher', category: 'View', run: () => ui().setLeftView('watcher') },
    { id: 'view.bug', title: 'Find Bug (Bug Detective)', category: 'View', run: () => ui().setLeftView('bug') },
    { id: 'view.tests', title: 'View: Test Guardian', category: 'View', run: () => ui().setLeftView('tests') },
    { id: 'tests.run', title: 'Run Tests', category: 'Self-Healing', run: () => { ui().setLeftView('tests'); void useTestGuardianStore.getState().runTests() } },
    {
      id: 'brain.analyze',
      title: 'Analyze Project (rebuild Project Brain)',
      category: 'Project Brain',
      run: () => {
        const r = ws().root
        if (!r) return
        ui().setLeftView('brain')
        void useBrainStore.getState().index(r)
      }
    },
    {
      id: 'brain.impact',
      title: 'Analyze Change Impact (current file)',
      category: 'Project Brain',
      run: () => {
        const r = ws().root
        const p = ed().activePath
        if (!r || !p) {
          notify('info', 'Open a file to analyze its change impact.')
          return
        }
        ui().setLeftView('brain')
        void useBrainStore.getState().analyzeImpact(r, p)
      }
    },
    { id: 'view.safe', title: 'View: Safe Mode (Snapshots)', category: 'View', run: () => ui().setLeftView('safe') },
    { id: 'view.builder', title: 'View: Code Builder', category: 'View', run: () => ui().setLeftView('builder') },
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
    { id: 'sel.explain', title: 'Explain Selection', category: 'Learn', run: () => ui().setWhy(explainAtCursor()) },
    { id: 'sel.askClaude', title: 'Ask Claude Code about Selection', category: 'Claude Code', run: () => void askClaudeAboutSelection() },

    { id: 'heal.view', title: 'View: Self-Healing', category: 'Self-Healing', run: () => ui().setLeftView('heal') },
    {
      id: 'heal.run',
      title: 'Run Self-Healing',
      category: 'Self-Healing',
      run: () => {
        if (!ws().root) {
          notify('info', 'Open a folder first.')
          return
        }
        ui().setLeftView('heal')
        void useHealStore.getState().run()
      }
    },

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
