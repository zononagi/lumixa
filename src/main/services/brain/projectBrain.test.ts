import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  analyzeImpact,
  disposeBrain,
  getBrain,
  indexProject,
  updateFile
} from './projectBrain'

let root = ''

async function write(rel: string, content: string): Promise<string> {
  const abs = join(root, rel)
  await fs.mkdir(join(abs, '..'), { recursive: true })
  await fs.writeFile(abs, content, 'utf-8')
  return abs
}

beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'lumixa-brain-'))
})

afterEach(async () => {
  disposeBrain(root)
  await fs.rm(root, { recursive: true, force: true })
})

describe('ProjectBrain — initial indexing', () => {
  it('builds a dependency graph, stats and summary; excludes node_modules and secrets', async () => {
    await write(
      'package.json',
      JSON.stringify({ name: 'demo', dependencies: { react: '^19' }, devDependencies: { vitest: '^4' } })
    )
    await write('tsconfig.json', '{}')
    await write('package-lock.json', '{}')
    await write('src/auth/session.ts', "export const login = () => {}\n")
    await write('src/auth/provider.tsx', "import { login } from './session'\nexport function Provider(){return (<div/>)}\n")
    await write('src/app.test.ts', "import { login } from './auth/session'\n")
    await write('.env', 'SECRET_TOKEN=abc123\n')
    // Should be ignored entirely:
    await write('node_modules/react/index.js', "module.exports = {}\n")

    const brain = await indexProject(root)

    expect(brain.isProject).toBe(true)
    expect(brain.name).toBe('demo')
    // node_modules excluded
    expect(brain.files.some((f) => f.rel.includes('node_modules'))).toBe(false)
    // secret flagged + content not read
    expect(brain.skippedSecrets).toContain('.env')
    const env = brain.files.find((f) => f.rel === '.env')
    expect(env?.loc).toBe(0)

    // dependency edge resolved: provider imports session
    const provider = brain.files.find((f) => f.rel === 'src/auth/provider.tsx')
    expect(provider?.imports).toContain('src/auth/session.ts')
    expect(provider?.kind).toBe('component')

    // stats
    expect(brain.stats.dependencies).toBe(2)
    expect(brain.stats.internalEdges).toBeGreaterThanOrEqual(2)
    expect(brain.stats.tests).toBe(1)
    expect(brain.stats.components).toBe(1)

    // summary
    expect(brain.summary.framework).toBe('React')
    expect(brain.summary.testing).toBe('Vitest')
    expect(brain.summary.language).toBe('TypeScript')
    expect(brain.summary.packageManager).toBe('npm')
  })

  it('handles a folder with no package.json gracefully', async () => {
    await write('index.js', "console.log('hi')\n")
    const brain = await indexProject(root)
    expect(brain.isProject).toBe(false)
    expect(brain.files.length).toBe(1)
  })
})

describe('ProjectBrain — incremental updates', () => {
  it('reflects modify, add and delete without a full reindex', async () => {
    await write('package.json', JSON.stringify({ name: 'demo' }))
    await write('src/a.ts', "export const a = 1\n")
    const bAbs = await write('src/b.ts', "export const b = 2\n")
    await indexProject(root)

    // Modify a.ts to import b.ts → edge appears incrementally
    const aAbs = join(root, 'src/a.ts')
    await fs.writeFile(aAbs, "import { b } from './b'\nexport const a = b\n")
    let brain = await updateFile(root, aAbs)
    expect(brain?.files.find((f) => f.rel === 'src/a.ts')?.imports).toContain('src/b.ts')

    // Add a new file
    const cAbs = await write('src/c.ts', "export const c = 3\n")
    brain = await updateFile(root, cAbs)
    expect(brain?.files.some((f) => f.rel === 'src/c.ts')).toBe(true)

    // Delete b.ts
    await fs.rm(bAbs)
    brain = await updateFile(root, bAbs)
    expect(brain?.files.some((f) => f.rel === 'src/b.ts')).toBe(false)
  })

  it('returns null when updating an unindexed root', async () => {
    const res = await updateFile(join(tmpdir(), 'never-indexed-xyz'), join(tmpdir(), 'x.ts'))
    expect(res).toBeNull()
  })
})

describe('ProjectBrain — impact', () => {
  it('computes impact and auto-indexes on demand', async () => {
    await write('package.json', JSON.stringify({ name: 'demo' }))
    await write('src/auth/session.ts', 'export const s = 1\n')
    await write('src/auth/provider.ts', "import { s } from './session'\nexport const p = s\n")
    disposeBrain(root) // ensure no cached brain → analyzeImpact must index

    const impact = await analyzeImpact(root, join(root, 'src/auth/session.ts'))
    expect(impact).not.toBeNull()
    expect(impact?.direct).toContain('src/auth/provider.ts')
    expect(impact?.critical).toBe(true)
    expect(getBrain(root)).not.toBeNull()
  })
})
