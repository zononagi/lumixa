import { describe, it, expect } from 'vitest'
import { redactSecrets } from './redact'

describe('redactSecrets', () => {
  it('redacts Anthropic API keys', () => {
    const out = redactSecrets('key is sk-ant-api03-ABCdef123456_XYZ done')
    expect(out).not.toContain('ABCdef123456')
    expect(out).toContain('sk-ant-***')
  })

  it('redacts bearer tokens and cookies', () => {
    expect(redactSecrets('Authorization: Bearer abcdef1234567890xyz')).toContain('Bearer ***')
    expect(redactSecrets('Cookie: session=deadbeefcafebabe1234')).toContain('Cookie: ***')
  })

  it('redacts key/secret/password assignments', () => {
    expect(redactSecrets('api_key = "supersecretvalue123"')).toContain('***')
    expect(redactSecrets('password: hunter2hunter2')).toContain('***')
  })

  it('leaves ordinary text untouched', () => {
    const text = 'Editing src/App.tsx and running npm test'
    expect(redactSecrets(text)).toBe(text)
  })
})
