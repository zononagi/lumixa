import { useEffect, type JSX } from 'react'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useGitStore } from '@renderer/stores/gitStore'
import { useAgentStore } from '@renderer/stores/agentStore'
import { useUiStore } from '@renderer/stores/uiStore'
import { useMarkersStore } from '@renderer/features/problems/markersStore'
import { explainAtCursor } from '@renderer/features/palette/commands'
import { runEditorAction } from '@renderer/lib/editorBridge'
import { useT } from '@renderer/i18n'
import { computeNextStep, type NextAction, type NextInput } from './whatsNext'

/**
 * "What's Next?" panel (spec §6, §7, §94). Reads the current project state from
 * existing stores, asks the pure engine for the single best next step, and
 * renders it with a "No Dead Ends" action rail. Every action maps onto an
 * existing Lumixa capability — Claude Code is only ever an optional escape hatch
 * (§79, §80), never required.
 */
export function WhatsNextPanel(): JSX.Element {
  const t = useT()
  const root = useWorkspaceStore((s) => s.root)
  const activeTab = useEditorStore((s) => s.tabs.find((tb) => tb.path === s.activePath))
  const hasOpenFile = useEditorStore((s) => s.tabs.length > 0)
  const problems = useMarkersStore((s) => s.problems)
  const gitStatus = useGitStore((s) => s.status)
  const providers = useAgentStore((s) => s.providers)
  const refreshProviders = useAgentStore((s) => s.refreshProviders)
  const gitRefresh = useGitStore((s) => s.refresh)

  // Refresh the two out-of-band signals (git status, Claude availability) when
  // this panel becomes relevant or the workspace changes — one call each.
  useEffect(() => {
    if (root) void gitRefresh()
  }, [root, gitRefresh])
  useEffect(() => {
    if (providers.length === 0) void refreshProviders()
  }, [providers.length, refreshProviders])

  const claudeAvailable = providers.some(
    (p) => p.id === 'claude-code' && p.state === 'authenticated'
  )

  const input: NextInput = {
    hasWorkspace: !!root,
    hasOpenFile,
    activeFileName: activeTab?.name,
    isDirty: !!activeTab?.dirty,
    errorCount: problems.filter((p) => p.severity >= 8).length,
    warningCount: problems.filter((p) => p.severity === 4).length,
    isRepo: !!gitStatus?.isRepo,
    changedFileCount: gitStatus?.files.length ?? 0,
    gitOperation: gitStatus?.operation,
    claudeAvailable
  }

  const step = computeNextStep(input)

  return (
    <div className="whatsnext">
      <div className={`wn-card ${step.tone}`}>
        <div className="wn-headline">
          <span className="wn-dot" />
          <span className="wn-title">{t(step.titleKey, step.vars)}</span>
        </div>
        {step.detailKey && <div className="wn-detail">{t(step.detailKey, step.vars)}</div>}
        <div className="wn-actions">
          {step.actions.map((a) => (
            <button
              key={a.id}
              className={`wn-btn ${a.primary ? 'primary' : ''}`}
              onClick={() => runAction(a)}
            >
              {t(a.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Map a declarative action id onto a real, existing Lumixa capability. */
function runAction(a: NextAction): void {
  const ui = useUiStore.getState()
  switch (a.id) {
    case 'openFolder':
      void useWorkspaceStore.getState().openFolder()
      break
    case 'openExplorer':
      ui.setLeftView('explorer')
      break
    case 'saveFile':
      void useEditorStore.getState().saveActive()
      break
    case 'quickFix':
      runEditorAction('editor.action.quickFix')
      break
    case 'explainCursor':
      ui.setWhy(explainAtCursor())
      break
    case 'showProblems':
      ui.setTerminal(true)
      ui.setBottomTab('problems')
      break
    case 'openSourceControl':
    case 'resolveConflicts':
      ui.setLeftView('git')
      void useGitStore.getState().refresh()
      break
    case 'showHealth':
      ui.setLeftView('health')
      break
    case 'askClaude':
      ui.setLeftView('agent')
      break
  }
}
