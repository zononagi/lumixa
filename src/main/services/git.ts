import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitBranches, GitResult, GitStatus, GitFile } from '@shared/ipc'

/**
 * Git service. Shells out to the system `git` (zero extra dependencies). All
 * calls are scoped to the workspace root passed from the renderer.
 */
const pexec = promisify(execFile)

async function git(
  cwd: string,
  args: string[]
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await pexec('git', args, {
      cwd,
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024
    })
    return { ok: true, stdout, stderr }
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    return { ok: false, stdout: e.stdout ?? '', stderr: e.stderr ?? e.message ?? 'git error' }
  }
}

/** Detect an in-progress merge or rebase so the UI can offer continue/abort. */
async function inProgress(cwd: string): Promise<'merge' | 'rebase' | undefined> {
  const rebase = await git(cwd, ['rev-parse', '--git-path', 'rebase-merge'])
  const rebaseApply = await git(cwd, ['rev-parse', '--git-path', 'rebase-apply'])
  const { existsSync } = await import('node:fs')
  if ((rebase.ok && existsSync(rebase.stdout.trim())) ||
      (rebaseApply.ok && existsSync(rebaseApply.stdout.trim()))) {
    return 'rebase'
  }
  const merge = await git(cwd, ['rev-parse', '--verify', '--quiet', 'MERGE_HEAD'])
  if (merge.ok && merge.stdout.trim()) return 'merge'
  return undefined
}

export async function status(cwd: string): Promise<GitStatus> {
  const inside = await git(cwd, ['rev-parse', '--is-inside-work-tree'])
  if (!inside.ok || inside.stdout.trim() !== 'true') {
    return { isRepo: false, branch: '', ahead: 0, behind: 0, files: [] }
  }
  const res = await git(cwd, ['status', '--porcelain=v1', '-b', '--untracked-files=all'])
  if (!res.ok) {
    return { isRepo: true, branch: '', ahead: 0, behind: 0, files: [], error: res.stderr }
  }

  const lines = res.stdout.split('\n').filter(Boolean)
  let branch = ''
  let ahead = 0
  let behind = 0
  const files: GitFile[] = []

  for (const line of lines) {
    if (line.startsWith('##')) {
      // e.g. "## main...origin/main [ahead 1, behind 2]"
      const header = line.slice(3)
      branch = header.split('...')[0].split(' ')[0]
      const am = header.match(/ahead (\d+)/)
      const bm = header.match(/behind (\d+)/)
      if (am) ahead = parseInt(am[1], 10)
      if (bm) behind = parseInt(bm[1], 10)
      continue
    }
    const index = line[0]
    const work = line[1]
    const path = line.slice(3)
    files.push({ path, index, work, staged: index !== ' ' && index !== '?' })
  }
  return { isRepo: true, branch, ahead, behind, files, operation: await inProgress(cwd) }
}

export async function stage(cwd: string, path: string): Promise<GitResult> {
  const r = await git(cwd, ['add', '--', path])
  return { ok: r.ok, output: r.stderr || r.stdout }
}

export async function unstage(cwd: string, path: string): Promise<GitResult> {
  const r = await git(cwd, ['reset', '-q', 'HEAD', '--', path])
  return { ok: r.ok, output: r.stderr || r.stdout }
}

export async function stageAll(cwd: string): Promise<GitResult> {
  const r = await git(cwd, ['add', '-A'])
  return { ok: r.ok, output: r.stderr || r.stdout }
}

export async function stagedDiff(cwd: string): Promise<string> {
  const r = await git(cwd, ['diff', '--cached'])
  return r.stdout
}

export async function commit(cwd: string, message: string): Promise<GitResult> {
  const r = await git(cwd, ['commit', '-m', message])
  return { ok: r.ok, output: r.stderr || r.stdout }
}

export async function push(cwd: string): Promise<GitResult> {
  const r = await git(cwd, ['push'])
  return { ok: r.ok, output: r.stderr || r.stdout }
}

export async function pull(cwd: string): Promise<GitResult> {
  const r = await git(cwd, ['pull'])
  return { ok: r.ok, output: r.stderr || r.stdout }
}

export async function branches(cwd: string): Promise<GitBranches> {
  const cur = await git(cwd, ['branch', '--show-current'])
  const all = await git(cwd, ['branch', '--format=%(refname:short)'])
  return {
    current: cur.stdout.trim(),
    all: all.stdout.split('\n').map((s) => s.trim()).filter(Boolean)
  }
}

export async function checkout(cwd: string, branch: string, create: boolean): Promise<GitResult> {
  const args = create ? ['checkout', '-b', branch] : ['checkout', branch]
  const r = await git(cwd, args)
  return { ok: r.ok, output: r.stderr || r.stdout }
}

export async function merge(cwd: string, branch: string): Promise<GitResult> {
  const r = await git(cwd, ['merge', '--no-edit', branch])
  return { ok: r.ok, output: r.stderr || r.stdout }
}

export async function mergeAbort(cwd: string): Promise<GitResult> {
  const r = await git(cwd, ['merge', '--abort'])
  return { ok: r.ok, output: r.stderr || r.stdout }
}

export async function rebase(cwd: string, branch: string): Promise<GitResult> {
  const r = await git(cwd, ['rebase', branch])
  return { ok: r.ok, output: r.stderr || r.stdout }
}

export async function rebaseContinue(cwd: string): Promise<GitResult> {
  // -c core.editor=true skips the interactive editor for the continue step.
  const r = await git(cwd, ['-c', 'core.editor=true', 'rebase', '--continue'])
  return { ok: r.ok, output: r.stderr || r.stdout }
}

export async function rebaseAbort(cwd: string): Promise<GitResult> {
  const r = await git(cwd, ['rebase', '--abort'])
  return { ok: r.ok, output: r.stderr || r.stdout }
}
