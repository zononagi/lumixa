import { describe, it, expect } from 'vitest'
import type { BrainFileNode } from '@shared/brain'
import { buildNeighborhood, pickDefaultCenter, whyConnected } from './graph'

const node = (
  rel: string,
  imports: string[] = [],
  over: Partial<BrainFileNode> = {}
): BrainFileNode => ({
  path: '/' + rel,
  rel,
  ext: '.ts',
  loc: 5,
  imports,
  packages: [],
  exports: [],
  kind: 'source',
  ...over
})

const files: BrainFileNode[] = [
  node('src/session.ts', [], { exports: ['login', 'logout', 'refresh'] }),
  node('src/provider.ts', ['src/session.ts']),
  node('src/dashboard.tsx', ['src/provider.ts'], { kind: 'component' }),
  node('src/session.test.ts', ['src/session.ts'], { kind: 'test' })
]

describe('buildNeighborhood', () => {
  it('splits imports (depends on) from importers (used by)', () => {
    const h = buildNeighborhood(files, 'src/session.ts')
    expect(h.center?.rel).toBe('src/session.ts')
    expect(h.imports).toEqual([]) // session imports nothing internal
    expect(h.importers.map((n) => n.rel).sort()).toEqual([
      'src/provider.ts',
      'src/session.test.ts'
    ])
  })

  it('caps each side and reports overflow', () => {
    const many = [
      node('hub.ts'),
      ...Array.from({ length: 12 }, (_, i) => node(`u${i}.ts`, ['hub.ts']))
    ]
    const h = buildNeighborhood(many, 'hub.ts', 8)
    expect(h.importers).toHaveLength(8)
    expect(h.moreImporters).toBe(4)
  })

  it('returns an empty neighborhood for an unknown center', () => {
    const h = buildNeighborhood(files, 'nope.ts')
    expect(h.center).toBeNull()
  })
})

describe('pickDefaultCenter', () => {
  it('chooses the most-imported source file', () => {
    expect(pickDefaultCenter(files)).toBe('src/session.ts')
  })
})

describe('whyConnected', () => {
  it('explains an edge with the target exports', () => {
    const h = buildNeighborhood(files, 'src/session.ts')
    const provider = h.importers.find((n) => n.rel === 'src/provider.ts')!
    const why = whyConnected(provider, h.center!)
    expect(why).toContain('imports')
    expect(why).toMatch(/login|logout|refresh/)
  })
})
