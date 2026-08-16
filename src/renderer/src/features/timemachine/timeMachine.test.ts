import { describe, it, expect } from 'vitest'
import type { BlameInfo, CommitInfo } from '@shared/ipc'
import { buildWhyPrompt, extractRefs } from './timeMachine'

describe('extractRefs', () => {
  it('pulls unique #refs in order', () => {
    expect(extractRefs('Fix login (#182), see also #94 and #182 again')).toEqual([182, 94])
  })
  it('returns empty for none', () => {
    expect(extractRefs('no references here')).toEqual([])
  })
})

describe('buildWhyPrompt', () => {
  const blame: BlameInfo = {
    hash: 'a82f31abcd',
    shortHash: 'a82f31ab',
    author: 'Nagisa',
    date: '2026-07-20',
    summary: 'Safari session refresh workaround'
  }
  const commit: CommitInfo = {
    hash: 'a82f31abcd',
    shortHash: 'a82f31ab',
    author: 'Nagisa',
    date: '2026-07-20',
    subject: 'Safari session refresh workaround (#182)',
    body: 'Works around a Safari bug. Closes #94.'
  }

  it('asks the three structured sections and embeds git evidence + refs', () => {
    const p = buildWhyPrompt('session.ts', 42, blame, commit, ['a82f31 2026-07-20 workaround — Nagisa'])
    expect(p).toMatch(/Original purpose/)
    expect(p).toMatch(/Risk of removing/)
    expect(p).toContain('session.ts')
    expect(p).toContain('a82f31ab')
    expect(p).toContain('Safari session refresh workaround')
    expect(p).toContain('#182')
    expect(p).toContain('#94')
    expect(p).toContain('Recent history of this file')
  })

  it('works without an introducing commit', () => {
    const p = buildWhyPrompt('a.ts', 1, blame, null, [])
    expect(p).toContain('a.ts')
    expect(p).not.toContain('Introducing commit')
  })
})
