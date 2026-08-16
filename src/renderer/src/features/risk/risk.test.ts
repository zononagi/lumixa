import { describe, it, expect } from 'vitest'
import type { BrainFileNode } from '@shared/brain'
import { classifyCritical, criticalAreas, scanRisks, buildRiskReviewPrompt } from './risk'

const node = (rel: string): BrainFileNode => ({
  path: '/' + rel, rel, ext: '.ts', loc: 5, imports: [], packages: [], exports: [], kind: 'source'
})

describe('classifyCritical', () => {
  it('classifies each critical area by path', () => {
    expect(classifyCritical('src/db/migrations/001_init.ts')).toBe('migration')
    expect(classifyCritical('src/database/schema.ts')).toBe('database')
    expect(classifyCritical('src/checkout/stripe.ts')).toBe('payments')
    expect(classifyCritical('src/auth/session.ts')).toBe('auth')
    expect(classifyCritical('.env.production')).toBe('secrets')
    expect(classifyCritical('Dockerfile')).toBe('infra')
    expect(classifyCritical('.github/workflows/deploy.yml')).toBe('deploy')
  })

  it('returns null for ordinary files', () => {
    expect(classifyCritical('src/ui/Button.tsx')).toBeNull()
  })

  it('prefers the more specific category (migration over database)', () => {
    expect(classifyCritical('src/database/migrations/add_users.sql')).toBe('migration')
  })
})

describe('scanRisks', () => {
  const files = [
    node('src/auth/session.ts'),
    node('src/db/schema.ts'),
    node('src/ui/Button.tsx')
  ]
  it('flags critical files and marks changed ones first', () => {
    const items = scanRisks(files, new Set(['src/db/schema.ts']))
    expect(items).toHaveLength(2) // Button.tsx excluded
    expect(items[0].rel).toBe('src/db/schema.ts')
    expect(items[0].changed).toBe(true)
    expect(items[1].changed).toBe(false)
  })

  it('groups critical files by category', () => {
    const areas = criticalAreas(scanRisks(files, new Set()))
    expect(areas.get('auth')?.map((i) => i.rel)).toEqual(['src/auth/session.ts'])
    expect(areas.get('database')?.map((i) => i.rel)).toEqual(['src/db/schema.ts'])
  })
})

describe('buildRiskReviewPrompt', () => {
  it('names the file, category and asks for a review-only pass', () => {
    const p = buildRiskReviewPrompt('src/auth/session.ts', 'auth')
    expect(p).toContain('src/auth/session.ts')
    expect(p).toContain('auth')
    expect(p).toMatch(/do not change files/i)
  })
})
