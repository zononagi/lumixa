import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listScripts, runScript } from './verify'

let root = ''

beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'lumixa-verify-'))
})
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('listScripts', () => {
  it('reports only the known verification scripts that exist', async () => {
    await fs.writeFile(
      join(root, 'package.json'),
      JSON.stringify({ scripts: { typecheck: 'tsc', test: 'vitest', dev: 'vite' } })
    )
    const res = await listScripts(root)
    expect(res.isProject).toBe(true)
    expect(res.available.sort()).toEqual(['test', 'typecheck'])
    // 'dev' is not a verification gate
    expect(res.available).not.toContain('build')
  })

  it('handles a folder without package.json', async () => {
    const res = await listScripts(root)
    expect(res.isProject).toBe(false)
    expect(res.available).toEqual([])
  })
})

describe('runScript', () => {
  it('captures a passing script (exit 0)', async () => {
    await fs.writeFile(
      join(root, 'package.json'),
      JSON.stringify({ scripts: { typecheck: 'node -e "console.log(\'ok-marker\')"' } })
    )
    const r = await runScript(root, 'typecheck', 60_000)
    expect(r.ok).toBe(true)
    expect(r.code).toBe(0)
    expect(r.output).toContain('ok-marker')
  }, 70_000)

  it('captures a failing script (non-zero exit) with output', async () => {
    await fs.writeFile(
      join(root, 'package.json'),
      JSON.stringify({ scripts: { test: 'node -e "console.error(\'boom-marker\'); process.exit(1)"' } })
    )
    const r = await runScript(root, 'test', 60_000)
    expect(r.ok).toBe(false)
    expect(r.code).not.toBe(0)
    expect(r.output).toContain('boom-marker')
  }, 70_000)
})
