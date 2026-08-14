import { describe, it, expect } from 'vitest'
import type { GitFile } from '@shared/ipc'
import { suggestCommitMessage } from './commitMessage'

const f = (path: string, work: string, staged = false): GitFile => ({
  path,
  index: staged ? work : ' ',
  work: staged ? ' ' : work,
  staged
})

describe('suggestCommitMessage', () => {
  it('returns empty for no files', () => {
    expect(suggestCommitMessage([])).toBe('')
  })

  it('names a single file with the right verb', () => {
    expect(suggestCommitMessage([f('src/User.tsx', '?')])).toBe('Add User.tsx')
    expect(suggestCommitMessage([f('src/User.tsx', 'M')])).toBe('Update User.tsx')
    expect(suggestCommitMessage([f('src/User.tsx', 'D')])).toBe('Remove User.tsx')
  })

  it('summarises multiple files in one directory', () => {
    const msg = suggestCommitMessage([f('src/a.ts', 'M'), f('src/b.ts', 'M')])
    expect(msg).toBe('Update src (2 files)')
  })

  it('summarises files spread across directories', () => {
    const msg = suggestCommitMessage([f('src/a.ts', 'M'), f('test/b.ts', 'M'), f('docs/c.md', 'M')])
    expect(msg).toBe('Update 3 files')
  })
})
