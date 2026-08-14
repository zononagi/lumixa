import { describe, it, expect } from 'vitest'
import { detectProjectType, describePath, entryPointCandidates } from './projectInsight'

describe('detectProjectType', () => {
  it('recognises frameworks with a TypeScript suffix', () => {
    expect(detectProjectType(['react', 'typescript'])).toBe('React + TypeScript')
    expect(detectProjectType(['next', 'react', 'typescript'])).toBe('Next.js + TypeScript')
    expect(detectProjectType(['electron', 'typescript'])).toBe('Electron + TypeScript')
    expect(detectProjectType(['express'])).toBe('Node.js API')
  })

  it('falls back sensibly', () => {
    expect(detectProjectType(['typescript'])).toBe('TypeScript')
    expect(detectProjectType([])).toBe('JavaScript / Node.js')
  })
})

describe('describePath', () => {
  it('explains common directory conventions', () => {
    expect(describePath('src/components/Button.tsx')).toBe('UI components')
    expect(describePath('src/services/api.ts')).toBe('API / external service calls')
    expect(describePath('src/hooks/useUser.ts')).toBe('Reusable React hooks')
    expect(describePath('src/foo/Button.test.tsx')).toBe('A test file')
  })

  it('returns undefined for unknown paths', () => {
    expect(describePath('random/thing.xyz')).toBeUndefined()
  })
})

describe('entryPointCandidates', () => {
  it('lists likely entry points, most-likely first', () => {
    const c = entryPointCandidates()
    expect(c[0]).toBe('src/main.tsx')
    expect(c).toContain('main.py')
  })
})
