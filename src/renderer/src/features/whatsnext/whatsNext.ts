/**
 * "What's Next?" engine (spec §6, §7, §77, §94).
 *
 * A pure, dependency-free function that reads a snapshot of the current project
 * state and returns exactly ONE recommended next step with a set of actions.
 * It ALWAYS returns a step — the "No Dead Ends" principle (§7): whatever the
 * state, the user is given a concrete way forward.
 *
 * This file has no React / window / store imports on purpose, so the priority
 * logic can be unit-tested in isolation. The panel maps the returned action ids
 * onto real handlers.
 */
import type { TKey } from '@renderer/i18n'

export type NextActionId =
  | 'openFolder'
  | 'openExplorer'
  | 'saveFile'
  | 'quickFix'
  | 'explainCursor'
  | 'showProblems'
  | 'openSourceControl'
  | 'resolveConflicts'
  | 'showHealth'
  | 'askClaude'

export interface NextAction {
  id: NextActionId
  /** i18n key for the button label. */
  labelKey: TKey
  primary?: boolean
}

export type NextTone = 'info' | 'warn' | 'error' | 'success'

export interface NextStep {
  /** i18n key for the plain-language headline. */
  titleKey: TKey
  /** i18n key for a one-line detail, when there is more to say. */
  detailKey?: TKey
  vars?: Record<string, string | number>
  tone: NextTone
  actions: NextAction[]
}

/** Everything the engine needs, gathered from existing stores by the caller. */
export interface NextInput {
  hasWorkspace: boolean
  hasOpenFile: boolean
  activeFileName?: string
  isDirty: boolean
  errorCount: number
  warningCount: number
  isRepo: boolean
  changedFileCount: number
  gitOperation?: 'merge' | 'rebase'
  /** Whether the local Claude Code CLI is available & signed in. */
  claudeAvailable: boolean
}

const ASK_CLAUDE: NextAction = { id: 'askClaude', labelKey: 'next.act.askClaude' }

/** Append the optional "Ask Claude Code" escape hatch when it's available. */
function withClaude(actions: NextAction[], available: boolean): NextAction[] {
  return available ? [...actions, ASK_CLAUDE] : actions
}

export function computeNextStep(input: NextInput): NextStep {
  // 1. Nothing open yet — the very first thing a beginner needs.
  if (!input.hasWorkspace) {
    return {
      titleKey: 'next.noWorkspace.title',
      detailKey: 'next.noWorkspace.detail',
      tone: 'info',
      actions: [{ id: 'openFolder', labelKey: 'next.act.openFolder', primary: true }]
    }
  }

  // 2. A merge/rebase is mid-flight — the most urgent, blocking state.
  if (input.gitOperation) {
    return {
      titleKey: 'next.conflict.title',
      detailKey: 'next.conflict.detail',
      vars: { op: input.gitOperation },
      tone: 'warn',
      actions: [
        { id: 'openSourceControl', labelKey: 'next.act.openSourceControl', primary: true },
        { id: 'resolveConflicts', labelKey: 'next.act.resolveConflicts' }
      ]
    }
  }

  // 3. Errors block everything — fix them first.
  if (input.errorCount > 0) {
    return {
      titleKey: 'next.errors.title',
      detailKey: 'next.errors.detail',
      vars: { n: input.errorCount },
      tone: 'error',
      actions: withClaude(
        [
          { id: 'quickFix', labelKey: 'next.act.fix', primary: true },
          { id: 'explainCursor', labelKey: 'next.act.explain' },
          { id: 'showProblems', labelKey: 'next.act.showProblems' }
        ],
        input.claudeAvailable
      )
    }
  }

  // 4. Warnings — worth reviewing, not blocking.
  if (input.warningCount > 0) {
    return {
      titleKey: 'next.warnings.title',
      vars: { n: input.warningCount },
      tone: 'warn',
      actions: withClaude(
        [
          { id: 'showProblems', labelKey: 'next.act.showProblems', primary: true },
          { id: 'explainCursor', labelKey: 'next.act.explain' }
        ],
        input.claudeAvailable
      )
    }
  }

  // 5. Unsaved edits — save before moving on.
  if (input.isDirty) {
    return {
      titleKey: 'next.unsaved.title',
      detailKey: 'next.unsaved.detail',
      vars: { file: input.activeFileName ?? '' },
      tone: 'info',
      actions: [{ id: 'saveFile', labelKey: 'next.act.save', primary: true }]
    }
  }

  // 6. Saved work that isn't committed yet — checkpoint it.
  if (input.isRepo && input.changedFileCount > 0) {
    return {
      titleKey: 'next.commit.title',
      detailKey: 'next.commit.detail',
      vars: { n: input.changedFileCount },
      tone: 'info',
      actions: [{ id: 'openSourceControl', labelKey: 'next.act.saveWork', primary: true }]
    }
  }

  // 7. Everything's clean but no file is open — pick something to edit.
  if (!input.hasOpenFile) {
    return {
      titleKey: 'next.openFile.title',
      tone: 'info',
      actions: [{ id: 'openExplorer', labelKey: 'next.act.openExplorer', primary: true }]
    }
  }

  // 8. All good — offer a healthy-project overview (still not a dead end).
  return {
    titleKey: 'next.allGood.title',
    detailKey: 'next.allGood.detail',
    tone: 'success',
    actions: [{ id: 'showHealth', labelKey: 'next.act.showHealth', primary: true }]
  }
}
