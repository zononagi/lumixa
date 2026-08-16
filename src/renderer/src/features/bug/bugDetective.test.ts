import { describe, it, expect } from 'vitest'
import {
  buildInvestigationPrompt,
  extractKeywords,
  relatedFiles,
  type BugEvidence
} from './bugDetective'

describe('extractKeywords', () => {
  it('pulls identifiers and drops stopwords/short tokens', () => {
    const kw = extractKeywords('The AuthProvider sometimes breaks refreshToken on login')
    expect(kw).toContain('AuthProvider')
    expect(kw).toContain('refreshToken')
    expect(kw).not.toContain('the')
    expect(kw).not.toContain('on') // too short
  })

  it('caps the number of keywords', () => {
    const many = Array.from({ length: 30 }, (_, i) => `token${i}`).join(' ')
    expect(extractKeywords(many).length).toBeLessThanOrEqual(12)
  })
})

describe('relatedFiles', () => {
  const files = [
    { rel: 'src/auth/AuthProvider.tsx' },
    { rel: 'src/auth/session.ts' },
    { rel: 'src/ui/Button.tsx' }
  ]
  it('matches files whose path contains a keyword', () => {
    const r = relatedFiles(files, ['authprovider', 'session'])
    expect(r).toContain('src/auth/AuthProvider.tsx')
    expect(r).toContain('src/auth/session.ts')
    expect(r).not.toContain('src/ui/Button.tsx')
  })
  it('returns nothing without keywords', () => {
    expect(relatedFiles(files, [])).toEqual([])
  })
})

describe('buildInvestigationPrompt', () => {
  const evidence: BugEvidence = {
    keywords: ['AuthProvider'],
    recentCommits: ['a82f31 fix session refresh'],
    hasUncommitted: true,
    diffSnippet: '- old\n+ new',
    problems: [{ path: 'a.ts', line: 3, message: 'boom', severity: 8 }],
    summary: { framework: 'React', language: 'TypeScript' },
    relatedFiles: ['src/auth/AuthProvider.tsx']
  }

  it('demands the hypothesis/evidence/confidence structure and includes evidence', () => {
    const p = buildInvestigationPrompt('screen goes blank after login', evidence)
    expect(p).toMatch(/## Hypotheses/)
    expect(p).toMatch(/## Reproduction/)
    expect(p).toMatch(/## Recommended fix/)
    expect(p).toContain('screen goes blank after login')
    expect(p).toContain('src/auth/AuthProvider.tsx')
    expect(p).toContain('a82f31 fix session refresh')
    expect(p).toContain('boom')
    expect(p).toContain('```diff')
    // must not pre-commit to a cause
    expect(p).toMatch(/Do not assert a cause without evidence/)
  })

  it('omits sections with no evidence', () => {
    const empty: BugEvidence = {
      keywords: [],
      recentCommits: [],
      hasUncommitted: false,
      diffSnippet: '',
      problems: [],
      summary: null,
      relatedFiles: []
    }
    const p = buildInvestigationPrompt('vague bug', empty)
    expect(p).not.toContain('Recent commits')
    expect(p).not.toContain('Uncommitted changes')
    expect(p).toContain('vague bug')
  })
})
