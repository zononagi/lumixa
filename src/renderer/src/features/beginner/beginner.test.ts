import { describe, it, expect } from 'vitest'
import { commandHelp, installCommandFor } from './beginner'

describe('commandHelp', () => {
  it('explains a known safe command', () => {
    const h = commandHelp('npm install', 'en')
    expect(h.known).toBe(true)
    expect(h.explanation).toMatch(/dependencies/i)
    expect(h.dangerous).toBe(false)
  })

  it('flags a dangerous command with a reason', () => {
    const h = commandHelp('rm -rf build', 'en')
    expect(h.dangerous).toBe(true)
    expect(h.reason).toBeTruthy()
  })

  it('marks unknown commands as not known', () => {
    const h = commandHelp('frobnicate --foo', 'en')
    expect(h.known).toBe(false)
    expect(h.explanation).toBeUndefined()
  })

  it('returns Japanese explanations when asked', () => {
    expect(commandHelp('npm install', 'ja').explanation).toMatch(/インストール/)
  })
})

describe('installCommandFor', () => {
  it('maps package managers to their install command', () => {
    expect(installCommandFor('pnpm')).toBe('pnpm install')
    expect(installCommandFor('yarn')).toBe('yarn')
    expect(installCommandFor('bun')).toBe('bun install')
    expect(installCommandFor(undefined)).toBe('npm install')
    expect(installCommandFor('npm')).toBe('npm install')
  })
})
