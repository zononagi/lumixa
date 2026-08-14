import { describe, it, expect } from 'vitest'
import { explainCommand } from './explainCommand'

describe('explainCommand', () => {
  it('explains common commands', () => {
    expect(explainCommand('npm install', 'en')).toContain('dependencies')
    expect(explainCommand('npm run dev', 'en')).toContain('development server')
    expect(explainCommand('git push', 'en')).toContain('remote')
    expect(explainCommand('npm install', 'ja')).toContain('依存')
  })

  it('flags destructive commands with a warning', () => {
    expect(explainCommand('rm -rf build', 'en')).toContain('⚠')
    expect(explainCommand('git reset --hard', 'en')).toContain('⚠')
  })

  it('returns undefined for unknown or empty input', () => {
    expect(explainCommand('', 'en')).toBeUndefined()
    expect(explainCommand('some-obscure-binary --flag', 'en')).toBeUndefined()
  })
})
