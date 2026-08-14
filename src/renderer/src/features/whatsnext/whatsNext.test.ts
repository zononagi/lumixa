import { describe, it, expect } from 'vitest'
import { computeNextStep, type NextInput } from './whatsNext'

const base: NextInput = {
  hasWorkspace: true,
  hasOpenFile: true,
  isDirty: false,
  errorCount: 0,
  warningCount: 0,
  isRepo: true,
  changedFileCount: 0,
  claudeAvailable: false
}

describe('computeNextStep', () => {
  it('always returns a step with at least one action (No Dead Ends)', () => {
    const permutations: NextInput[] = [
      base,
      { ...base, hasWorkspace: false },
      { ...base, errorCount: 3 },
      { ...base, warningCount: 1 },
      { ...base, isDirty: true },
      { ...base, changedFileCount: 4 },
      { ...base, hasOpenFile: false },
      { ...base, gitOperation: 'merge' }
    ]
    for (const p of permutations) {
      const step = computeNextStep(p)
      expect(step.titleKey).toBeTruthy()
      expect(step.actions.length).toBeGreaterThan(0)
    }
  })

  it('prioritises opening a workspace above all else', () => {
    const step = computeNextStep({ ...base, hasWorkspace: false, errorCount: 9 })
    expect(step.actions[0].id).toBe('openFolder')
  })

  it('prioritises an in-progress merge/rebase over errors', () => {
    const step = computeNextStep({ ...base, gitOperation: 'rebase', errorCount: 5 })
    expect(step.tone).toBe('warn')
    expect(step.actions[0].id).toBe('openSourceControl')
    expect(step.vars?.op).toBe('rebase')
  })

  it('recommends fixing errors before warnings/saving', () => {
    const step = computeNextStep({ ...base, errorCount: 2, warningCount: 5, isDirty: true })
    expect(step.tone).toBe('error')
    expect(step.actions[0].id).toBe('quickFix')
    expect(step.vars?.n).toBe(2)
  })

  it('surfaces warnings when there are no errors', () => {
    const step = computeNextStep({ ...base, warningCount: 3 })
    expect(step.tone).toBe('warn')
    expect(step.actions[0].id).toBe('showProblems')
  })

  it('asks to save unsaved edits before committing', () => {
    const step = computeNextStep({ ...base, isDirty: true, changedFileCount: 3 })
    expect(step.actions[0].id).toBe('saveFile')
  })

  it('recommends committing saved changes', () => {
    const step = computeNextStep({ ...base, changedFileCount: 3 })
    expect(step.actions[0].id).toBe('openSourceControl')
    expect(step.vars?.n).toBe(3)
  })

  it('reports a clean, healthy project as success', () => {
    const step = computeNextStep(base)
    expect(step.tone).toBe('success')
    expect(step.actions[0].id).toBe('showHealth')
  })

  it('appends "Ask Claude Code" only when available', () => {
    const without = computeNextStep({ ...base, errorCount: 1, claudeAvailable: false })
    expect(without.actions.some((a) => a.id === 'askClaude')).toBe(false)
    const withIt = computeNextStep({ ...base, errorCount: 1, claudeAvailable: true })
    expect(withIt.actions.some((a) => a.id === 'askClaude')).toBe(true)
  })
})
