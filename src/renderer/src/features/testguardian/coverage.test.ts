import { describe, it, expect } from 'vitest'
import type { BrainFileNode } from '@shared/brain'
import { buildGenerateTestsPrompt, computeCoverage } from './coverage'

const node = (rel: string, kind: BrainFileNode['kind'], imports: string[] = []): BrainFileNode => ({
  path: '/' + rel,
  rel,
  ext: '.ts',
  loc: 5,
  imports,
  packages: [],
  exports: [],
  kind
})

describe('computeCoverage', () => {
  it('treats a source file imported by a test as covered', () => {
    const files = [
      node('src/a.ts', 'source'),
      node('src/b.ts', 'source'),
      node('src/a.test.ts', 'test', ['src/a.ts'])
    ]
    const cov = computeCoverage(files)
    expect(cov.testable).toBe(2)
    expect(cov.covered).toBe(1)
    expect(cov.uncovered.map((u) => u.rel)).toEqual(['src/b.ts'])
    expect(cov.testFiles).toBe(1)
    expect(cov.percent).toBe(50)
  })

  it('ignores config/style/doc files as non-testable', () => {
    const files = [
      node('src/App.tsx', 'component'),
      node('src/styles.css', 'style'),
      node('README.md', 'doc'),
      node('vite.config.ts', 'config')
    ]
    const cov = computeCoverage(files)
    expect(cov.testable).toBe(1)
    expect(cov.uncovered.map((u) => u.rel)).toEqual(['src/App.tsx'])
  })

  it('returns null percent when nothing is testable', () => {
    expect(computeCoverage([node('README.md', 'doc')]).percent).toBeNull()
  })
})

describe('buildGenerateTestsPrompt', () => {
  it('names the file and the framework', () => {
    const p = buildGenerateTestsPrompt('src/util.ts', 'Vitest')
    expect(p).toContain('src/util.ts')
    expect(p).toContain('Vitest')
  })
  it('omits framework phrasing when unknown', () => {
    const p = buildGenerateTestsPrompt('src/util.ts', undefined)
    expect(p).toContain('src/util.ts')
    expect(p).not.toContain('using undefined')
  })
})
