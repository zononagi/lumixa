import { describe, it, expect } from 'vitest'
import type { BrainFileNode } from '@shared/brain'
import { detectSummary } from './summary'

const file = (rel: string): BrainFileNode => ({
  path: '/' + rel,
  rel,
  ext: '.ts',
  loc: 1,
  imports: [],
  packages: [],
  exports: [],
  kind: 'source'
})

describe('detectSummary', () => {
  it('reads a typical React + Vite + Zustand + Vitest stack', () => {
    const declared = new Set(['react', 'vite', 'zustand', 'vitest', '@mui/material', 'typescript'])
    const s = detectSummary(declared, [file('src/features/x/a.ts')], {
      hasTsconfig: true,
      lockfiles: ['package-lock.json']
    })
    expect(s.framework).toBe('React')
    expect(s.build).toBe('Vite')
    expect(s.state).toBe('Zustand')
    expect(s.testing).toBe('Vitest')
    expect(s.ui).toBe('MUI')
    expect(s.language).toBe('TypeScript')
    expect(s.packageManager).toBe('npm')
    expect(s.architecture).toBe('Feature-based')
    expect(s.runtime).toBe('Web')
  })

  it('prefers electron-vite and detects the Electron runtime', () => {
    const declared = new Set(['react', 'electron', 'electron-vite', 'vite'])
    const s = detectSummary(declared, [], { hasTsconfig: false, lockfiles: ['pnpm-lock.yaml'] })
    expect(s.build).toBe('electron-vite')
    expect(s.runtime).toBe('Electron (desktop)')
    expect(s.packageManager).toBe('pnpm')
    expect(s.language).toBe('JavaScript')
  })

  it('detects a Node backend with no frontend framework', () => {
    const declared = new Set(['express', 'typescript'])
    const s = detectSummary(declared, [], { hasTsconfig: true, lockfiles: [] })
    expect(s.backend).toBe('Express')
    expect(s.framework).toBeUndefined()
    expect(s.runtime).toBe('Node.js')
  })
})
