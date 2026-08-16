import { create } from 'zustand'
import type { VerifyResult, VerifyScript } from '@shared/engine'
import { MAX_HEAL_ATTEMPTS, VERIFY_SCRIPTS } from '@shared/engine'
import { useWorkspaceStore } from './workspaceStore'
import { useAgentStore } from './agentStore'
import { notify } from './notifyStore'

/**
 * Self-Healing Engine (spec §18–§21). Runs the project's verification gates
 * (typecheck / test / build / lint); on failure it hands the captured error to
 * the user's Claude Code CLI with a fix prompt, re-verifies, and loops — capped
 * at MAX_HEAL_ATTEMPTS so it can never run away.
 *
 * Safety: a snapshot checkpoint is taken before any repair so every change is
 * undoable (spec §59). Only the named npm scripts are ever executed — never
 * arbitrary or destructive commands (spec §21). Fixes are applied by Claude Code
 * under its own permission model; Lumixa doesn't bypass it.
 */

export type StepStatus = 'running' | 'ok' | 'fail' | 'info'

export interface HealStep {
  id: number
  label: string
  status: StepStatus
  detail?: string
}

export type HealOutcome = 'idle' | 'passed' | 'failed' | 'stopped'

interface HealState {
  available: VerifyScript[]
  selected: VerifyScript[]
  loadingScripts: boolean

  running: boolean
  cancelRequested: boolean
  attempts: number
  steps: HealStep[]
  outcome: HealOutcome
  checkpointId: string | null
  healSessionId: string | null

  refreshScripts: (root: string) => Promise<void>
  toggle: (script: VerifyScript) => void
  run: () => Promise<void>
  stop: () => void
  undo: () => Promise<void>
  clear: () => void
}

let stepSeq = 0

export const useHealStore = create<HealState>((set, get) => ({
  available: [],
  selected: [],
  loadingScripts: false,
  running: false,
  cancelRequested: false,
  attempts: 0,
  steps: [],
  outcome: 'idle',
  checkpointId: null,
  healSessionId: null,

  refreshScripts: async (root) => {
    set({ loadingScripts: true })
    try {
      const res = await window.lumixa.verify.scripts(root)
      set((s) => ({
        available: res.available,
        // Keep any prior selection that's still valid; else select all found.
        selected: s.selected.length
          ? s.selected.filter((x) => res.available.includes(x))
          : res.available,
        loadingScripts: false
      }))
    } catch {
      set({ loadingScripts: false })
    }
  },

  toggle: (script) =>
    set((s) => ({
      selected: s.selected.includes(script)
        ? s.selected.filter((x) => x !== script)
        : VERIFY_SCRIPTS.filter((x) => s.selected.includes(x) || x === script)
    })),

  run: async () => {
    if (get().running) return
    const root = useWorkspaceStore.getState().root
    if (!root) {
      notify('warn', 'Open a folder first.')
      return
    }
    const scripts = VERIFY_SCRIPTS.filter((s) => get().selected.includes(s))
    if (scripts.length === 0) {
      notify('info', 'Select at least one check to run.')
      return
    }

    set({ running: true, cancelRequested: false, attempts: 0, steps: [], outcome: 'idle' })

    // 1) Safety checkpoint for undo (spec §59).
    const cp = addStep(set, 'Creating a safety snapshot', 'running')
    try {
      const snap = await window.lumixa.snapshot.create(root, 'Before Self-Healing')
      set({ checkpointId: snap.meta?.id ?? null })
      updateStep(set, cp, snap.ok ? 'ok' : 'info', snap.message)
    } catch {
      updateStep(set, cp, 'info', 'Snapshot unavailable — continuing without a checkpoint.')
    }

    const claudeReady = useAgentStore
      .getState()
      .providers.some((p) => p.id === 'claude-code' && p.state === 'authenticated')

    let outcome: HealOutcome = 'failed'

    for (let attempt = 1; attempt <= MAX_HEAL_ATTEMPTS; attempt++) {
      if (get().cancelRequested) {
        outcome = 'stopped'
        break
      }
      set({ attempts: attempt })

      // 2) Run verification gates.
      const failures = await runGates(set, get, root, scripts)
      if (get().cancelRequested) {
        outcome = 'stopped'
        break
      }
      if (failures.length === 0) {
        addStep(set, '✓ All checks passed', 'ok')
        outcome = 'passed'
        break
      }

      if (attempt === MAX_HEAL_ATTEMPTS) {
        addStep(set, `Reached the ${MAX_HEAL_ATTEMPTS}-attempt limit — stopping`, 'info')
        outcome = 'failed'
        break
      }
      if (!claudeReady) {
        addStep(set, 'Claude Code is not available to apply a fix', 'fail')
        outcome = 'failed'
        break
      }

      // 3) Ask Claude Code to fix the failures, then loop back to verify.
      const fixStep = addStep(set, `Claude Code is investigating (attempt ${attempt})`, 'running')
      const id = await ensureHealSession(get, set)
      if (!id) {
        updateStep(set, fixStep, 'fail', 'Could not start a Claude Code session.')
        outcome = 'failed'
        break
      }
      const prompt = buildFixPrompt(failures)
      const res = await useAgentStore.getState().sendAndWait(id, prompt)
      if (get().cancelRequested) {
        updateStep(set, fixStep, 'info', 'Stopped by user.')
        outcome = 'stopped'
        break
      }
      updateStep(set, fixStep, res.ok ? 'ok' : 'fail', res.ok ? 'Fix applied — re-verifying' : 'Claude Code could not complete the fix')
      if (!res.ok) {
        outcome = 'failed'
        break
      }
    }

    set({ running: false, outcome })
    if (outcome === 'passed') notify('success', '✓ Self-Healing: all checks pass')
    else if (outcome === 'failed') notify('warn', 'Self-Healing could not fully resolve the problem')
  },

  stop: () => {
    if (get().running) set({ cancelRequested: true })
  },

  undo: async () => {
    const root = useWorkspaceStore.getState().root
    const id = get().checkpointId
    if (!root || !id) return
    const step = addStep(set, 'Reverting to the pre-heal snapshot', 'running')
    try {
      const res = await window.lumixa.snapshot.restore(root, id)
      updateStep(set, step, res.ok ? 'ok' : 'fail', res.message)
      if (res.ok) notify('success', 'Reverted all Self-Healing changes')
    } catch (e) {
      updateStep(set, step, 'fail', e instanceof Error ? e.message : 'Restore failed')
    }
  },

  clear: () =>
    set({ steps: [], attempts: 0, outcome: 'idle', checkpointId: null })
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SetFn = (fn: (s: HealState) => Partial<HealState>) => void

function addStep(set: SetFn, label: string, status: StepStatus): number {
  const id = ++stepSeq
  set((s) => ({ steps: [...s.steps, { id, label, status }] }))
  return id
}

function updateStep(set: SetFn, id: number, status: StepStatus, detail?: string): void {
  set((s) => ({
    steps: s.steps.map((st) => (st.id === id ? { ...st, status, detail: detail ?? st.detail } : st))
  }))
}

async function runGates(
  set: SetFn,
  get: () => HealState,
  root: string,
  scripts: VerifyScript[]
): Promise<VerifyResult[]> {
  const failures: VerifyResult[] = []
  for (const script of scripts) {
    if (get().cancelRequested) break
    const step = addStep(set, `Running ${script}`, 'running')
    const r = await window.lumixa.verify.run(root, script)
    updateStep(
      set,
      step,
      r.ok ? 'ok' : 'fail',
      r.ok ? `passed in ${(r.durationMs / 1000).toFixed(1)}s` : `exit ${r.code ?? '—'}${r.timedOut ? ' (timed out)' : ''}`
    )
    if (!r.ok) failures.push(r)
  }
  return failures
}

async function ensureHealSession(get: () => HealState, set: SetFn): Promise<string | null> {
  const existing = get().healSessionId
  const agent = useAgentStore.getState()
  if (existing && agent.sessionsById[existing]) return existing
  const id = await agent.createSession('claude-code')
  if (id) {
    void agent.rename(id, 'Self-Healing')
    set(() => ({ healSessionId: id }))
  }
  return id
}

function buildFixPrompt(failures: VerifyResult[]): string {
  const blocks = failures
    .map(
      (f) =>
        `## \`npm run ${f.script}\` failed (exit ${f.code ?? 'unknown'})\n\n\`\`\`\n${f.output}\n\`\`\``
    )
    .join('\n\n')
  return (
    'A verification step failed in this project. Find the root cause and fix it directly in the ' +
    'code, then stop. Do not change unrelated files. Keep changes minimal.\n\n' +
    blocks
  )
}
