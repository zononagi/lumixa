import type { ContextKind } from './agentContext'
import type { TKey } from '@renderer/i18n'

/**
 * One-tap prompts (spec §10). Each action ships a beginner-friendly prompt and
 * the context it needs. Actions marked `codeScoped` attach the current selection
 * when there is one, otherwise the whole current file — so "Explain" always has
 * something concrete to talk about without the user pasting code.
 */
export interface QuickAction {
  id: string
  labelKey: TKey
  prompt: string
  /** Extra context kinds always attached (in addition to code scope). */
  extraContext?: ContextKind[]
  /** When true, attach selection-or-file automatically. */
  codeScoped: boolean
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'explain',
    labelKey: 'qa.explain',
    prompt: 'Explain what this code does, in plain language a beginner can follow.',
    codeScoped: true
  },
  {
    id: 'fix',
    labelKey: 'qa.fix',
    prompt: 'Find and fix any bugs or errors in this code. Explain what was wrong.',
    codeScoped: true,
    extraContext: ['problems']
  },
  {
    id: 'refactor',
    labelKey: 'qa.refactor',
    prompt: 'Refactor this code to be cleaner and easier to read, without changing its behavior.',
    codeScoped: true
  },
  {
    id: 'optimize',
    labelKey: 'qa.optimize',
    prompt: 'Optimize this code for better performance. Explain the trade-offs.',
    codeScoped: true
  },
  {
    id: 'tests',
    labelKey: 'qa.tests',
    prompt: 'Write unit tests for this code, matching the testing style already used in this project.',
    codeScoped: true
  },
  {
    id: 'docs',
    labelKey: 'qa.docs',
    prompt: 'Add clear documentation comments to this code.',
    codeScoped: true
  },
  {
    id: 'findBug',
    labelKey: 'qa.findBug',
    prompt: 'Review this code and point out any bugs, edge cases, or risks you can find.',
    codeScoped: true,
    extraContext: ['problems']
  },
  {
    id: 'review',
    labelKey: 'qa.review',
    prompt: 'Review this code for correctness, readability, and best practices, and suggest improvements.',
    codeScoped: true
  }
]
