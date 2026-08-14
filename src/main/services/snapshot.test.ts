import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createSnapshot,
  listSnapshots,
  restoreSnapshot,
  deleteSnapshot
} from './snapshot'

let workspace: string
let store: string

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'lumixa-ws-'))
  store = await mkdtemp(join(tmpdir(), 'lumixa-snap-'))
  await fs.writeFile(join(workspace, 'a.ts'), 'export const a = 1\n')
  await fs.mkdir(join(workspace, 'src'))
  await fs.writeFile(join(workspace, 'src', 'b.ts'), 'export const b = 2\n')
  // Excluded dir must never be captured.
  await fs.mkdir(join(workspace, 'node_modules', 'pkg'), { recursive: true })
  await fs.writeFile(join(workspace, 'node_modules', 'pkg', 'index.js'), 'junk')
})

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true })
  await rm(store, { recursive: true, force: true })
})

describe('snapshot service', () => {
  it('creates a snapshot of source files, excluding node_modules', async () => {
    const res = await createSnapshot(store, workspace, 'first')
    expect(res.ok).toBe(true)
    expect(res.meta?.fileCount).toBe(2) // a.ts + src/b.ts, NOT node_modules
    const list = await listSnapshots(store, workspace)
    expect(list).toHaveLength(1)
    expect(list[0].label).toBe('first')
  })

  it('restores changed files and auto-creates a safety snapshot first (§57)', async () => {
    await createSnapshot(store, workspace, 'checkpoint')

    // Mutate the workspace after the snapshot.
    await fs.writeFile(join(workspace, 'a.ts'), 'export const a = 999\n')

    const res = await restoreSnapshot(store, workspace, (await listSnapshots(store, workspace))[0].id)
    expect(res.ok).toBe(true)

    // File content is back to the snapshot.
    expect(await fs.readFile(join(workspace, 'a.ts'), 'utf-8')).toContain('a = 1')

    // A "Before restore" safety snapshot now also exists (§57).
    const list = await listSnapshots(store, workspace)
    expect(list.some((m) => m.auto && m.label === 'Before restore')).toBe(true)
  })

  it('does not delete files created after the snapshot (safer net)', async () => {
    await createSnapshot(store, workspace, 'cp')
    await fs.writeFile(join(workspace, 'new.ts'), 'export const n = 0\n')
    await restoreSnapshot(store, workspace, (await listSnapshots(store, workspace)).find((m) => m.label === 'cp')!.id)
    // The newer file survives a restore.
    await expect(fs.access(join(workspace, 'new.ts'))).resolves.toBeUndefined()
  })

  it('rejects ids that try to escape the store', async () => {
    const res = await restoreSnapshot(store, workspace, '../../etc')
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/invalid/i)
  })

  it('deletes a snapshot', async () => {
    const created = await createSnapshot(store, workspace, 'temp')
    await deleteSnapshot(store, workspace, created.meta!.id)
    expect(await listSnapshots(store, workspace)).toHaveLength(0)
  })

  it('returns an empty list for a workspace with no snapshots', async () => {
    const other = await mkdtemp(join(tmpdir(), 'lumixa-ws2-'))
    expect(await listSnapshots(store, other)).toEqual([])
    await rm(other, { recursive: true, force: true })
  })
})
