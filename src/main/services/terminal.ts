import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import type { ShellInfo, TerminalCreateRequest } from '@shared/ipc'

/**
 * Terminal service. Manages long-lived shell child processes with piped stdio.
 *
 * We deliberately avoid a native PTY (node-pty) to keep the app buildable with
 * no C++ toolchain. Each shell reads commands from its stdin pipe and streams
 * stdout/stderr back — enough for running commands, capturing logs, and letting
 * users run commands. Line editing / echo is handled in the renderer.
 */

interface Session {
  child: ChildProcessWithoutNullStreams
}

const sessions = new Map<string, Session>()

/** Detect the shells available on this machine. */
export function listShells(): ShellInfo[] {
  const out: ShellInfo[] = []
  if (process.platform === 'win32') {
    const sysRoot = process.env.SystemRoot ?? 'C:\\Windows'
    out.push({
      id: 'powershell',
      label: 'PowerShell',
      path: `${sysRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
    })
    out.push({ id: 'cmd', label: 'Command Prompt', path: `${sysRoot}\\System32\\cmd.exe` })
    const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe'
    if (existsSync(gitBash)) out.push({ id: 'gitbash', label: 'Git Bash', path: gitBash })
    const wsl = `${sysRoot}\\System32\\wsl.exe`
    if (existsSync(wsl)) out.push({ id: 'wsl', label: 'WSL', path: wsl })
  } else {
    const zsh = '/bin/zsh'
    const bash = '/bin/bash'
    if (existsSync(zsh)) out.push({ id: 'zsh', label: 'zsh', path: zsh })
    if (existsSync(bash)) out.push({ id: 'bash', label: 'bash', path: bash })
  }
  return out
}

/** Arguments that put each shell into a stdin-driven command loop. */
function argsFor(shellPath: string): string[] {
  const p = shellPath.toLowerCase()
  if (p.endsWith('powershell.exe')) return ['-NoLogo', '-NoProfile']
  // cmd: leave echo ON so the command is visible after we erase our local echo.
  if (p.endsWith('cmd.exe')) return []
  if (p.endsWith('wsl.exe')) return []
  // bash / zsh: read commands from stdin (not -i; no tty over a pipe)
  return []
}

export function createTerminal(
  req: TerminalCreateRequest,
  onData: (data: string) => void,
  onExit: (code: number | null) => void
): void {
  const cwd = req.cwd && existsSync(req.cwd) ? req.cwd : homedir()
  const child = spawn(req.shellPath, argsFor(req.shellPath), {
    cwd,
    env: { ...process.env, TERM: 'xterm-256color' },
    windowsHide: true
  })

  child.stdout.on('data', (d: Buffer) => onData(d.toString('utf-8')))
  child.stderr.on('data', (d: Buffer) => onData(d.toString('utf-8')))
  child.on('exit', (code) => {
    sessions.delete(req.id)
    onExit(code)
  })
  child.on('error', (err) => onData(`\r\n[terminal error] ${err.message}\r\n`))

  sessions.set(req.id, { child })
}

export function writeTerminal(id: string, data: string): void {
  sessions.get(id)?.child.stdin.write(data)
}

export function killTerminal(id: string): void {
  const s = sessions.get(id)
  if (!s) return
  s.child.kill()
  sessions.delete(id)
}

/** Kill every shell — called on app shutdown. */
export function killAllTerminals(): void {
  for (const [, s] of sessions) s.child.kill()
  sessions.clear()
}
