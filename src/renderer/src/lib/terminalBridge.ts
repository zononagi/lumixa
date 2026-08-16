/**
 * A tiny bridge that lets non-terminal features (e.g. the Beginner Assistant)
 * run a command in the live terminal without owning the xterm session. The
 * active TerminalView registers a runner; callers invoke runInTerminal().
 * Mirrors the pattern of editorBridge.ts.
 */
type Runner = (command: string) => void

let runner: Runner | null = null

export function setTerminalRunner(fn: Runner | null): void {
  runner = fn
}

/** Run a command in the active terminal. Returns false if none is mounted. */
export function runInTerminal(command: string): boolean {
  if (!runner) return false
  runner(command)
  return true
}

export function hasTerminal(): boolean {
  return runner !== null
}
