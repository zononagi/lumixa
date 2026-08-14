import type { GitFile } from '@shared/ipc'

/**
 * Commit Assistant (spec §47). Suggests a plain, conventional commit message
 * from the set of changed files — pure heuristics, no AI. Beginners get a
 * reasonable starting message they can edit before committing.
 */

function baseName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

/** Detect the dominant change verb from the working-tree status codes. */
function verb(files: GitFile[]): string {
  const codes = files.map((f) => (f.staged ? f.index : f.work))
  const allAdded = codes.every((c) => c === 'A' || c === '?')
  const allDeleted = codes.every((c) => c === 'D')
  if (allAdded) return 'Add'
  if (allDeleted) return 'Remove'
  return 'Update'
}

export function suggestCommitMessage(files: GitFile[]): string {
  if (files.length === 0) return ''
  const v = verb(files)
  if (files.length === 1) {
    return `${v} ${baseName(files[0].path)}`
  }
  // Group by top-level directory to describe a multi-file change concisely.
  const dirs = new Set(
    files.map((f) => {
      const parts = f.path.replace(/\\/g, '/').split('/')
      return parts.length > 1 ? parts[0] : baseName(f.path)
    })
  )
  if (dirs.size === 1) {
    return `${v} ${[...dirs][0]} (${files.length} files)`
  }
  return `${v} ${files.length} files`
}
