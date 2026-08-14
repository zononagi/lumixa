import { promises as fs } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, relative } from 'node:path'
import type { SnapshotMeta, SnapshotResult } from '@shared/ipc'

/**
 * Safe Mode snapshots (spec §52–§60). A *temporary safety net*, deliberately NOT
 * a Git replacement (§54): a quick copy of the workspace's source files so a
 * risky change (Code Builder, multi-file Quick Fix, refactor, restore) can be
 * undone even without version control.
 *
 * Heavy / regenerable directories (node_modules, .git, dist, …) are excluded
 * (§54) and oversized files are skipped, so snapshots stay small and fast (§84,
 * §91 disk-usage). This module takes the snapshots root as a parameter and never
 * imports electron, so the logic is unit-testable without the app.
 */

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.cache',
  '.next',
  'coverage',
  '.turbo',
  '.vite'
])

/** Skip individual files larger than this — snapshots are for source, not blobs. */
const MAX_FILE_BYTES = 5 * 1024 * 1024
/** Guardrail: refuse to snapshot pathologically large trees. */
const MAX_FILES = 8000

function hashPath(p: string): string {
  return createHash('sha1').update(p).digest('hex').slice(0, 16)
}

function workspaceDir(snapshotsRoot: string, workspacePath: string): string {
  return join(snapshotsRoot, hashPath(workspacePath))
}

/** An id we generated is safe; reject anything that could escape the store. */
function isValidId(id: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(id) && !id.includes('..')
}

/** Collect workspace-relative file paths, applying dir excludes and the size cap. */
async function collectFiles(root: string): Promise<string[]> {
  const files: string[] = []
  async function rec(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const e of entries) {
      if (files.length > MAX_FILES) return
      const abs = join(dir, e.name)
      if (e.isDirectory()) {
        if (EXCLUDED_DIRS.has(e.name)) continue
        await rec(abs)
      } else if (e.isFile()) {
        try {
          const st = await fs.stat(abs)
          if (st.size > MAX_FILE_BYTES) continue
          files.push(relative(root, abs))
        } catch {
          /* unreadable — skip */
        }
      }
    }
  }
  await rec(root)
  return files
}

async function copyAll(fromRoot: string, toRoot: string, rels: string[]): Promise<number> {
  let n = 0
  for (const rel of rels) {
    const dest = join(toRoot, rel)
    await fs.mkdir(dirname(dest), { recursive: true })
    await fs.copyFile(join(fromRoot, rel), dest)
    n++
  }
  return n
}

export async function createSnapshot(
  snapshotsRoot: string,
  workspacePath: string,
  label = '',
  auto = false
): Promise<SnapshotResult> {
  const rels = await collectFiles(workspacePath)
  if (rels.length > MAX_FILES) {
    return { ok: false, message: 'This project is too large to snapshot safely.' }
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const snapDir = join(workspaceDir(snapshotsRoot, workspacePath), id)
  const filesDir = join(snapDir, 'files')
  try {
    const fileCount = await copyAll(workspacePath, filesDir, rels)
    const meta: SnapshotMeta = {
      id,
      createdAt: Date.now(),
      workspace: workspacePath,
      label: label.trim(),
      fileCount,
      auto
    }
    await fs.writeFile(join(snapDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8')
    return { ok: true, message: `Snapshot saved (${fileCount} files).`, meta }
  } catch {
    // Best-effort cleanup of a partial snapshot.
    await fs.rm(snapDir, { recursive: true, force: true }).catch(() => {})
    return { ok: false, message: 'Could not create the snapshot.' }
  }
}

export async function listSnapshots(
  snapshotsRoot: string,
  workspacePath: string
): Promise<SnapshotMeta[]> {
  const wsDir = workspaceDir(snapshotsRoot, workspacePath)
  let ids: string[]
  try {
    ids = (await fs.readdir(wsDir, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return []
  }
  const metas: SnapshotMeta[] = []
  for (const id of ids) {
    try {
      const raw = await fs.readFile(join(wsDir, id, 'meta.json'), 'utf-8')
      metas.push(JSON.parse(raw) as SnapshotMeta)
    } catch {
      /* corrupted/partial snapshot — skip it (§91) */
    }
  }
  return metas.sort((a, b) => b.createdAt - a.createdAt)
}

export async function restoreSnapshot(
  snapshotsRoot: string,
  workspacePath: string,
  id: string
): Promise<SnapshotResult> {
  if (!isValidId(id)) return { ok: false, message: 'Invalid snapshot.' }
  const snapDir = join(workspaceDir(snapshotsRoot, workspacePath), id)
  const filesDir = join(snapDir, 'files')
  try {
    await fs.access(join(snapDir, 'meta.json'))
  } catch {
    return { ok: false, message: 'That snapshot could not be found.' }
  }

  // §57: capture the CURRENT state first, so a restore is itself undoable.
  await createSnapshot(snapshotsRoot, workspacePath, 'Before restore', true)

  // Copy the snapshot's files back over the workspace. This overwrites changed
  // files but does not delete files created after the snapshot — a safer net.
  const rels = await collectFiles(filesDir)
  try {
    const restored = await copyAll(filesDir, workspacePath, rels)
    return { ok: true, message: `Restored ${restored} file(s). A safety snapshot of your previous state was saved first.` }
  } catch {
    return { ok: false, message: 'Something went wrong while restoring.' }
  }
}

export async function deleteSnapshot(
  snapshotsRoot: string,
  workspacePath: string,
  id: string
): Promise<SnapshotResult> {
  if (!isValidId(id)) return { ok: false, message: 'Invalid snapshot.' }
  const dir = join(workspaceDir(snapshotsRoot, workspacePath), id)
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  return { ok: true, message: 'Snapshot deleted.' }
}
