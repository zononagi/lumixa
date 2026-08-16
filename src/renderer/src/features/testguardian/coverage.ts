import type { BrainFileNode } from '@shared/brain'

/**
 * Test Guardian coverage model (spec §22-§23). Derives a lightweight, static
 * "is this file exercised by a test?" map from the Project Brain dependency
 * graph: a test file's imports are the modules it covers. Pure + unit-tested.
 *
 * This is import-level coverage (not line coverage) — enough to flag files that
 * no test touches at all, which is what the Guardian nudges about.
 */

export interface UncoveredFile {
  rel: string
  path: string
  kind: BrainFileNode['kind']
}

export interface CoverageReport {
  /** Source/component files that *should* have tests. */
  testable: number
  covered: number
  uncovered: UncoveredFile[]
  testFiles: number
  /** 0-100, or null when there is nothing testable. */
  percent: number | null
}

const TESTABLE = new Set<BrainFileNode['kind']>(['source', 'component'])

export function computeCoverage(files: BrainFileNode[]): CoverageReport {
  const covered = new Set<string>()
  let testFiles = 0
  for (const f of files) {
    if (f.kind === 'test') {
      testFiles++
      for (const dep of f.imports) covered.add(dep)
    }
  }

  const testable = files.filter((f) => TESTABLE.has(f.kind))
  const uncovered = testable
    .filter((f) => !covered.has(f.rel))
    .map((f) => ({ rel: f.rel, path: f.path, kind: f.kind }))
    .sort((a, b) => a.rel.localeCompare(b.rel))

  return {
    testable: testable.length,
    covered: testable.length - uncovered.length,
    uncovered,
    testFiles,
    percent: testable.length === 0 ? null : Math.round(((testable.length - uncovered.length) / testable.length) * 100)
  }
}

/** Prompt for generating tests for a file, matching the project's style. */
export function buildGenerateTestsPrompt(rel: string, framework: string | undefined): string {
  const fw = framework ? ` using ${framework}` : ''
  return (
    `Write unit tests${fw} for \`${rel}\` in this project. Read the file and match the existing ` +
    `test style and folder convention already used here. Cover the main behaviors and important ` +
    `edge cases. Create the test file; do not modify unrelated code.`
  )
}
