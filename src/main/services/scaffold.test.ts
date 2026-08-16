import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scaffold } from './scaffold'

let base = ''

beforeEach(async () => {
  base = await fs.mkdtemp(join(tmpdir(), 'lumixa-scaffold-'))
})
afterEach(async () => {
  await fs.rm(base, { recursive: true, force: true })
})

const read = (root: string, rel: string): Promise<string> => fs.readFile(join(root, rel), 'utf-8')

describe('scaffold', () => {
  it('creates a runnable React + TS + Vite project with valid package.json', async () => {
    const targetDir = join(base, 'my-app')
    const res = await scaffold({ targetDir, name: 'my-app', templateId: 'react-ts-vite', features: ['Dark mode'] })
    expect(res.ok).toBe(true)
    expect(res.root).toBe(targetDir)
    expect(res.files).toContain('package.json')
    expect(res.files).toContain('src/App.tsx')

    const pkg = JSON.parse(await read(targetDir, 'package.json'))
    expect(pkg.name).toBe('my-app')
    expect(pkg.scripts.build).toBeTruthy()
    expect(pkg.dependencies.react).toBeTruthy()

    // README lists the requested feature
    expect(await read(targetDir, 'README.md')).toContain('Dark mode')
    // App.tsx is valid-ish and embeds the feature list without template-literal leaks
    const app = await read(targetDir, 'src/App.tsx')
    expect(app).toContain('Dark mode')
    expect(app).not.toContain('${')
  })

  it('creates a Node + TS project', async () => {
    const targetDir = join(base, 'svc')
    const res = await scaffold({ targetDir, name: 'svc', templateId: 'node-ts', features: [] })
    expect(res.ok).toBe(true)
    expect(res.files).toContain('src/index.ts')
    const pkg = JSON.parse(await read(targetDir, 'package.json'))
    expect(pkg.devDependencies.typescript).toBeTruthy()
  })

  it('refuses to write into a non-empty folder (safety §35)', async () => {
    const targetDir = join(base, 'used')
    await fs.mkdir(targetDir, { recursive: true })
    await fs.writeFile(join(targetDir, 'keep.txt'), 'hi')
    const res = await scaffold({ targetDir, name: 'used', templateId: 'react-ts-vite', features: [] })
    expect(res.ok).toBe(false)
    expect(res.files).toEqual([])
    // existing file untouched
    expect(await read(targetDir, 'keep.txt')).toBe('hi')
  })

  it('rejects an empty name', async () => {
    const res = await scaffold({ targetDir: join(base, 'x'), name: '', templateId: 'react-ts-vite', features: [] })
    expect(res.ok).toBe(false)
  })
})
