import { describe, it, expect } from 'vitest'
import { scanContent } from './rules'

const ids = (rel: string, text: string): string[] =>
  scanContent(rel, text).map((f) => f.ruleId)

describe('scanContent', () => {
  it('ignores non-code files', () => {
    expect(scanContent('README.md', 'debugger\nconsole.log(1)')).toEqual([])
  })

  it('flags a debugger statement (high confidence)', () => {
    const f = scanContent('src/a.ts', 'function x(){\n  debugger\n}')
    expect(f).toHaveLength(1)
    expect(f[0].ruleId).toBe('debugger')
    expect(f[0].confidence).toBe('high')
    expect(f[0].line).toBe(2)
  })

  it('flags hard-coded secrets', () => {
    const f = scanContent('src/config.ts', "const apiKey = 'sk-live-1234567890abcdef'\n")
    expect(f.some((x) => x.ruleId === 'hardcoded-secret' && x.category === 'security')).toBe(true)
  })

  it('flags empty catch blocks', () => {
    const f = scanContent('src/a.ts', 'try {\n  work()\n} catch (e) {}\n')
    expect(f.some((x) => x.ruleId === 'empty-catch')).toBe(true)
  })

  it('flags loose equality but not strict equality or arrows', () => {
    expect(ids('src/a.ts', 'if (a == b) {}')).toContain('loose-equality')
    expect(ids('src/a.ts', 'if (a === b) {}')).not.toContain('loose-equality')
    expect(ids('src/a.ts', 'const f = () => 1')).not.toContain('loose-equality')
  })

  it('suggests a request timeout only when none is present', () => {
    expect(ids('src/api.ts', "await fetch('/x')")).toContain('no-timeout')
    expect(ids('src/api.ts', "await fetch('/x', { signal })")).not.toContain('no-timeout')
  })

  it('does not flag issues that live only in comments', () => {
    expect(ids('src/a.ts', '// debugger here is just a note')).not.toContain('debugger')
  })

  it('marks TODO and any as low confidence', () => {
    const f = scanContent('src/a.ts', '// nothing\nlet z: any = 1 // TODO refine')
    const any = f.find((x) => x.ruleId === 'any-type')
    expect(any?.confidence).toBe('low')
  })
})
