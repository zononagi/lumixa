import { describe, it, expect } from 'vitest'
import type { BrainFileNode } from '@shared/brain'
import { allFacts, deriveFacts, formatFacts, type SkillFact } from './skillMemory'

const comp = (rel: string): BrainFileNode => ({
  path: '/' + rel, rel, ext: '.tsx', loc: 5, imports: [], packages: [], exports: [], kind: 'component'
})
const test = (rel: string): BrainFileNode => ({
  path: '/' + rel, rel, ext: '.ts', loc: 5, imports: [], packages: [], exports: [], kind: 'test'
})

describe('deriveFacts', () => {
  it('reports stack facts from the summary with package.json source + high confidence', () => {
    const facts = deriveFacts(
      { framework: 'React', state: 'Zustand', testing: 'Vitest', packageManager: 'npm' },
      []
    )
    const byText = (s: string): SkillFact | undefined => facts.find((f) => f.text.includes(s))
    expect(byText('React')?.source).toBe('package.json')
    expect(byText('React')?.confidence).toBe('high')
    expect(byText('Zustand')).toBeTruthy()
    expect(byText('Package manager: npm')?.source).toBe('config')
  })

  it('detects PascalCase component naming as a code pattern', () => {
    const files = [comp('src/Button.tsx'), comp('src/Card.tsx'), comp('src/Modal.tsx')]
    const facts = deriveFacts(null, files)
    const naming = facts.find((f) => f.text.includes('PascalCase'))
    expect(naming?.source).toBe('code pattern')
    expect(naming?.confidence).toBe('medium')
  })

  it('detects the .test.* convention', () => {
    const files = [test('a.test.ts'), test('b.test.ts'), test('c.test.ts')]
    const facts = deriveFacts(null, files)
    expect(facts.some((f) => f.text.includes('*.test.*'))).toBe(true)
  })

  it('does not invent facts from an empty project', () => {
    expect(deriveFacts(null, [])).toEqual([])
  })
})

describe('allFacts + formatFacts', () => {
  const user: SkillFact = { id: 'u1', text: 'Do not use Redux', source: 'user instruction', confidence: 'high' }
  it('sorts by confidence and includes provenance in the formatted block', () => {
    const derived = deriveFacts({ framework: 'React', architecture: 'Feature-based' }, [])
    const merged = allFacts(derived, [user])
    // high-confidence first
    expect(merged[0].confidence).toBe('high')
    const text = formatFacts(merged)
    expect(text).toContain('Do not use Redux')
    expect(text).toContain('user instruction')
    expect(text).toContain('high confidence')
  })
  it('formats empty as empty string', () => {
    expect(formatFacts([])).toBe('')
  })
})
