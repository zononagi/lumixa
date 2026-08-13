import { spawn, type ChildProcess } from 'node:child_process'
import { redactSecrets } from './redact'

/**
 * Wraps a single child-process run of an agent turn. Responsible for:
 *  - streaming stdout as whole lines (NDJSON-friendly),
 *  - collecting stderr,
 *  - timeout + user cancellation,
 *  - killing the whole process *tree* (Claude Code spawns children; on Windows
 *    a plain kill leaves orphans), so nothing is left running after Lumixa exits.
 */
export interface AgentProcessHandlers {
  onLine: (line: string) => void
  onStderr: (chunk: string) => void
  onClose: (result: { code: number | null; killed: boolean; timedOut: boolean }) => void
}

export interface AgentProcessOptions {
  command: string
  args: string[]
  cwd: string
  env?: Record<string, string>
  /** Run through the OS shell (for .cmd/.bat shims on Windows). */
  shell?: boolean
  /** Hard cap for a single turn. Default 10 minutes. */
  timeoutMs?: number
}

export class AgentProcess {
  private child: ChildProcess | null = null
  private stdoutBuf = ''
  private timedOut = false
  private killed = false
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly opts: AgentProcessOptions,
    private readonly handlers: AgentProcessHandlers
  ) {}

  get pid(): number | undefined {
    return this.child?.pid
  }

  start(): void {
    const child = spawn(this.opts.command, this.opts.args, {
      cwd: this.opts.cwd,
      env: { ...process.env, ...this.opts.env },
      windowsHide: true,
      // Detached is left false; we tree-kill explicitly by pid to avoid orphans.
      shell: this.opts.shell ?? false
    })
    this.child = child

    child.stdout?.setEncoding('utf-8')
    child.stdout?.on('data', (chunk: string) => this.onStdout(chunk))
    child.stderr?.setEncoding('utf-8')
    child.stderr?.on('data', (chunk: string) => this.handlers.onStderr(redactSecrets(chunk)))

    child.on('error', (err) => {
      this.handlers.onStderr(redactSecrets(`[spawn error] ${err.message}`))
      this.finish(null)
    })
    child.on('close', (code) => this.finish(code))

    const timeoutMs = this.opts.timeoutMs ?? 10 * 60_000
    this.timer = setTimeout(() => {
      this.timedOut = true
      this.kill()
    }, timeoutMs)
  }

  private onStdout(chunk: string): void {
    this.stdoutBuf += chunk
    let idx: number
    while ((idx = this.stdoutBuf.indexOf('\n')) >= 0) {
      const line = this.stdoutBuf.slice(0, idx)
      this.stdoutBuf = this.stdoutBuf.slice(idx + 1)
      if (line.length) this.handlers.onLine(line)
    }
  }

  private finish(code: number | null): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    // Flush any trailing partial line.
    const rest = this.stdoutBuf.trim()
    if (rest.length) this.handlers.onLine(rest)
    this.stdoutBuf = ''
    const child = this.child
    this.child = null
    if (child) child.removeAllListeners()
    this.handlers.onClose({ code, killed: this.killed, timedOut: this.timedOut })
  }

  /** Cancel the run and kill the whole process tree. Safe to call repeatedly. */
  kill(): void {
    const child = this.child
    if (!child || child.pid === undefined) return
    this.killed = true
    killTree(child)
  }
}

/** Kill a process and all of its descendants across OSes. */
export function killTree(child: ChildProcess): void {
  const pid = child.pid
  if (pid === undefined) return
  if (process.platform === 'win32') {
    // taskkill terminates the whole tree; detached so we don't wait on it.
    try {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore'
      }).unref()
    } catch {
      try {
        child.kill('SIGKILL')
      } catch {
        /* already gone */
      }
    }
  } else {
    try {
      child.kill('SIGTERM')
      // Escalate if it lingers.
      setTimeout(() => {
        try {
          if (child.pid) process.kill(child.pid, 'SIGKILL')
        } catch {
          /* already gone */
        }
      }, 2_000).unref()
    } catch {
      /* already gone */
    }
  }
}
