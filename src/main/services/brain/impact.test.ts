import { describe, it, expect } from 'vitest'
import type { BrainFileNode } from '@shared/brain'
import { computeImpact } from './impact'

const node = (rel: string, imports: string[], over: Partial<BrainFileNode> = {}): BrainFileNode => ({
  path: '/' + rel,
  rel,
  ext: '.ts',
  loc: 10,
  imports,
  packages: [],
  exports: [],
  kind: 'source',
  ...over
})

describe('computeImpact', () => {
  // graph: session <- auth <- dashboard ; session <- authTest(test)
  const files: BrainFileNode[] = [
    node('src/auth/session.ts', []),
    node('src/auth/provider.ts', ['src/auth/session.ts']),
    node('src/pages/dashboard.tsx', ['src/auth/provider.ts'], { kind: 'component' }),
    node('src/auth/session.test.ts', ['src/auth/session.ts'], { kind: 'test' })
  ]

  it('finds direct and indirect dependents', () => {
    const r = computeImpact(files, 'src/auth/session.ts')
    expect(r.direct).toContain('src/auth/provider.ts')
    expect(r.direct).toContain('src/auth/session.test.ts')
    expect(r.indirect).toContain('src/pages/dashboard.tsx')
    expect(r.affectedTests).toEqual(['src/auth/session.test.ts'])
  })

  it('marks critical areas and scores them higher', () => {
    const r = computeImpact(files, 'src/auth/session.ts')
    expect(r.critical).toBe(true)
    expect(r.riskScore).toBeGreaterThan(33)
    expect(r.reasons.join(' ')).toMatch(/critical/i)
  })

  it('reports an isolated file as low risk', () => {
    const isolated = [...files, node('src/util/lonely.ts', [])]
    const r = computeImpact(isolated, 'src/util/lonely.ts')
    expect(r.direct).toEqual([])
    expect(r.indirect).toEqual([])
    expect(r.riskLevel).toBe('low')
    expect(r.reasons.join(' ')).toMatch(/isolated/i)
  })

  it('clamps the score to 0-100', () => {
    const r = computeImpact(files, 'src/auth/session.ts')
    expect(r.riskScore).toBeGreaterThanOrEqual(0)
    expect(r.riskScore).toBeLessThanOrEqual(100)
  })
})
