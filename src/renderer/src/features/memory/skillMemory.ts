import type { BrainFileNode, ProjectSummary } from '@shared/brain'

/**
 * Skill Memory (spec §33-§35). Per-project development knowledge, each fact
 * carrying a SOURCE and a CONFIDENCE so nothing is presented as truth without
 * provenance (§34) and uncertain rules aren't asserted (§35).
 *
 * Auto-derived facts are recomputed from the live project (package.json via the
 * Brain summary, and code patterns) — never stored — so they can't go stale.
 * User-stated rules are stored separately by the store. Pure + unit-tested.
 */

export type FactSource =
  | 'package.json'
  | 'config'
  | 'code pattern'
  | 'user instruction'
  | 'documentation'

export type FactConfidence = 'high' | 'medium' | 'low'

export interface SkillFact {
  id: string
  text: string
  source: FactSource
  confidence: FactConfidence
}

const baseName = (rel: string): string => (rel.split('/').pop() ?? rel).replace(/\.[^.]+$/, '')

/** Derive project knowledge from the Brain summary + code patterns. */
export function deriveFacts(summary: ProjectSummary | null, files: BrainFileNode[]): SkillFact[] {
  const facts: SkillFact[] = []
  const push = (id: string, text: string, source: FactSource, confidence: FactConfidence): void => {
    facts.push({ id: `d:${id}`, text, source, confidence })
  }

  if (summary) {
    const stack: [string, string | undefined][] = [
      ['framework', summary.framework],
      ['language', summary.language],
      ['build', summary.build],
      ['state', summary.state],
      ['ui', summary.ui],
      ['testing', summary.testing],
      ['backend', summary.backend]
    ]
    for (const [key, val] of stack) {
      if (val) push(key, `Uses ${val}`, 'package.json', 'high')
    }
    if (summary.packageManager) {
      push('pm', `Package manager: ${summary.packageManager}`, 'config', 'high')
    }
    if (summary.architecture) {
      push('arch', `${summary.architecture} project structure`, 'code pattern', 'medium')
    }
  }

  // Naming convention: are component files PascalCase?
  const components = files.filter((f) => f.kind === 'component')
  if (components.length >= 3) {
    const pascal = components.filter((f) => /^[A-Z][A-Za-z0-9]*$/.test(baseName(f.rel))).length
    const ratio = pascal / components.length
    if (ratio >= 0.8) {
      push('naming', 'Components use PascalCase file names', 'code pattern', 'medium')
    }
  }

  // Test file convention: .test.* vs .spec.*
  const tests = files.filter((f) => f.kind === 'test')
  if (tests.length >= 3) {
    const dotTest = tests.filter((f) => /\.test\./.test(f.rel)).length
    const dotSpec = tests.filter((f) => /\.spec\./.test(f.rel)).length
    if (dotTest > dotSpec && dotTest / tests.length >= 0.6) {
      push('testconv', 'Test files use the `*.test.*` naming', 'code pattern', 'medium')
    } else if (dotSpec > dotTest && dotSpec / tests.length >= 0.6) {
      push('testconv', 'Test files use the `*.spec.*` naming', 'code pattern', 'medium')
    }
  }

  return facts
}

const CONF_ORDER: Record<FactConfidence, number> = { high: 0, medium: 1, low: 2 }

/** All facts (derived + user), sorted by confidence for display/prompting. */
export function allFacts(derived: SkillFact[], user: SkillFact[]): SkillFact[] {
  return [...derived, ...user].sort((a, b) => CONF_ORDER[a.confidence] - CONF_ORDER[b.confidence])
}

/** Markdown block for handing project knowledge to Claude Code (spec §40). */
export function formatFacts(facts: SkillFact[]): string {
  if (facts.length === 0) return ''
  return facts.map((f) => `- ${f.text} _(${f.source}, ${f.confidence} confidence)_`).join('\n')
}
