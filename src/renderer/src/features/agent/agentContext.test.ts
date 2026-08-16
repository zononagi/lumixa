import { describe, it, expect } from 'vitest'
import { composeMessage, formatBlock, problemsToText, type ContextBlock } from './agentContext'
import type { Problem } from '@renderer/features/problems/markersStore'

const block = (over: Partial<ContextBlock> = {}): ContextBlock => ({
  kind: 'file',
  label: 'Current file (App.tsx)',
  text: 'contents',
  ...over
})

describe('composeMessage', () => {
  it('returns the prompt unchanged when there is no context', () => {
    expect(composeMessage('hello', [])).toBe('hello')
  })

  it('prepends a labelled context preamble before the prompt', () => {
    const msg = composeMessage('Explain this', [block()])
    expect(msg).toContain('### Current file (App.tsx)')
    expect(msg).toContain('contents')
    // The user's prompt comes after the separator.
    expect(msg.indexOf('Explain this')).toBeGreaterThan(msg.indexOf('### Current file'))
    expect(msg).toContain('---')
  })

  it('joins multiple blocks', () => {
    const msg = composeMessage('q', [
      block({ label: 'A', text: 'a' }),
      block({ kind: 'problems', label: 'B', text: 'b' })
    ])
    expect(msg).toContain('### A')
    expect(msg).toContain('### B')
  })
})

describe('formatBlock', () => {
  it('truncates very large bodies', () => {
    const huge = 'x'.repeat(20_000)
    const out = formatBlock(block({ text: huge }))
    expect(out.length).toBeLessThan(huge.length)
    expect(out).toContain('truncated')
  })
})

describe('problemsToText', () => {
  const p = (over: Partial<Problem>): Problem => ({
    resource: 'file:///App.tsx',
    path: 'App.tsx',
    line: 1,
    column: 1,
    message: 'oops',
    severity: 8,
    ...over
  })

  it('renders errors and warnings with location and code', () => {
    const text = problemsToText([
      p({ message: 'bad', code: 'TS2304' }),
      p({ severity: 4, message: 'meh', line: 9 })
    ])
    expect(text).toContain('error App.tsx:1:1 — bad (TS2304)')
    expect(text).toContain('warning App.tsx:9:1 — meh')
  })

  it('handles an empty list', () => {
    expect(problemsToText([])).toBe('(no problems reported)')
  })
})
