import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { AgentEvent, ProviderStatus } from '@shared/agent'
import type { AIProvider, RunSpec, RunSpecInput } from './types'

const pexec = promisify(execFile)

/**
 * Provider that drives the user's locally-installed Claude Code CLI.
 *
 * SECURITY: Lumixa never implements Claude auth, and never reads, stores, or
 * transmits Claude tokens / cookies / the CLI's internal auth DB. Authentication
 * is entirely the CLI's responsibility. We only ever read the *boolean*
 * logged-in flag reported by `claude auth status` — never the email/org/token.
 *
 * The CLI spec is NOT hardcoded from assumptions: detection reads the real
 * `--version`, and streaming is parsed from the real `--output-format
 * stream-json` NDJSON protocol.
 */
export class ClaudeCodeProvider implements AIProvider {
  readonly id = 'claude-code'
  readonly name = 'Claude Code'

  /** Major versions Lumixa has been validated against. */
  private static readonly SUPPORTED_MAJORS = new Set([2])

  /** Resolved executable path, cached from the most recent detect(). */
  private exePath: string | null = null

  async detect(): Promise<ProviderStatus> {
    const exe = await locateExecutable()
    this.exePath = exe
    if (!exe) {
      return {
        id: this.id,
        name: this.name,
        state: 'not-installed',
        detail:
          'Claude Code was not found on this machine. Install it, then reopen this panel.'
      }
    }

    // Version (never fatal).
    let version: string | undefined
    let compatibility: ProviderStatus['compatibility'] = 'unknown'
    try {
      const { stdout } = await pexec(exe, ['--version'], { windowsHide: true, timeout: 10_000 })
      version = parseVersion(stdout)
      const major = version ? Number(version.split('.')[0]) : NaN
      compatibility = ClaudeCodeProvider.SUPPORTED_MAJORS.has(major) ? 'supported' : 'unknown'
    } catch {
      return {
        id: this.id,
        name: this.name,
        state: 'error',
        executablePath: exe,
        detail: 'Found Claude Code, but could not read its version. It may be damaged.'
      }
    }

    // Auth — read ONLY the loggedIn boolean. Do not retain any other field.
    const loggedIn = await readLoggedIn(exe)
    if (loggedIn === true) {
      return {
        id: this.id,
        name: this.name,
        state: 'authenticated',
        version,
        compatibility,
        executablePath: exe,
        detail: 'Ready.'
      }
    }
    if (loggedIn === false) {
      return {
        id: this.id,
        name: this.name,
        state: 'unauthenticated',
        version,
        compatibility,
        executablePath: exe,
        detail: 'Claude Code is installed but not signed in. Run `claude` in a terminal to log in.'
      }
    }
    // Auth state indeterminate — treat as installed (safe side).
    return {
      id: this.id,
      name: this.name,
      state: 'installed',
      version,
      compatibility,
      executablePath: exe,
      detail: 'Installed. Sign-in status could not be confirmed.'
    }
  }

  createRunSpec(input: RunSpecInput): RunSpec {
    const args: string[] = [
      '-p',
      input.message,
      '--output-format',
      'stream-json',
      '--verbose'
    ]
    // Session continuity: assign a stable id on the first turn, resume after.
    if (input.resume) {
      args.push('--resume', input.sessionId)
    } else {
      args.push('--session-id', input.sessionId)
    }
    if (input.model) args.push('--model', input.model)
    args.push('--permission-mode', input.permissionMode ?? 'default')

    // Prefer the resolved executable path (Windows spawn needs the real path,
    // not the bare "claude" name). Shell out only for .cmd/.bat shims.
    const command = this.exePath ?? 'claude'
    return {
      command,
      args,
      cwd: input.workspacePath,
      shell: /\.(cmd|bat)$/i.test(command)
    }
  }

  parseLine(line: string): AgentEvent[] {
    const trimmed = line.trim()
    if (!trimmed || trimmed[0] !== '{') return [] // ignore non-JSON noise
    let obj: Record<string, unknown>
    try {
      obj = JSON.parse(trimmed)
    } catch {
      return [] // tolerate malformed / partial lines
    }
    return mapObject(obj)
  }
}

// ---------------------------------------------------------------------------
// Executable location
// ---------------------------------------------------------------------------

/** Resolve the Claude Code executable across OSes without guessing the spec. */
async function locateExecutable(): Promise<string | null> {
  const finder = process.platform === 'win32' ? 'where' : 'which'
  try {
    const { stdout } = await pexec(finder, ['claude'], { windowsHide: true, timeout: 8_000 })
    const first = stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)[0]
    if (first && existsSync(first)) return first
  } catch {
    // fall through to well-known locations
  }
  const home = homedir()
  const candidates =
    process.platform === 'win32'
      ? [
          join(home, '.local', 'bin', 'claude.exe'),
          join(home, '.local', 'bin', 'claude.cmd'),
          join(home, 'AppData', 'Local', 'Programs', 'claude', 'claude.exe')
        ]
      : [
          join(home, '.local', 'bin', 'claude'),
          '/usr/local/bin/claude',
          '/opt/homebrew/bin/claude'
        ]
  for (const c of candidates) if (existsSync(c)) return c
  return null
}

function parseVersion(raw: string): string | undefined {
  const m = raw.match(/(\d+\.\d+\.\d+)/)
  return m ? m[1] : undefined
}

/**
 * Returns true/false for signed-in, or null if it couldn't be determined.
 * Reads ONLY the `loggedIn` flag; every other field is intentionally discarded.
 */
async function readLoggedIn(exe: string): Promise<boolean | null> {
  try {
    const { stdout } = await pexec(exe, ['auth', 'status'], {
      windowsHide: true,
      timeout: 10_000
    })
    const json = JSON.parse(stdout) as { loggedIn?: unknown }
    if (typeof json.loggedIn === 'boolean') return json.loggedIn
    return null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// NDJSON -> AgentEvent mapping (based on the real stream-json protocol)
// ---------------------------------------------------------------------------

const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'NotebookEdit'])

function mapObject(obj: Record<string, unknown>): AgentEvent[] {
  const type = obj.type as string | undefined

  if (type === 'system') {
    if (obj.subtype === 'init') {
      return [
        {
          kind: 'session-init',
          providerSessionId: String(obj.session_id ?? ''),
          model: String(obj.model ?? ''),
          cwd: String(obj.cwd ?? ''),
          version: String(obj.claude_code_version ?? '')
        }
      ]
    }
    return [] // thinking_tokens, post_turn_summary, etc. — not surfaced
  }

  if (type === 'assistant') {
    return mapAssistant(obj)
  }

  if (type === 'user') {
    return mapUserToolResults(obj)
  }

  if (type === 'result') {
    return mapResult(obj)
  }

  return []
}

interface ContentBlock {
  type?: string
  text?: string
  thinking?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  is_error?: boolean
  content?: unknown
}

function contentOf(obj: Record<string, unknown>): ContentBlock[] {
  const message = obj.message as { content?: unknown } | undefined
  const content = message?.content
  return Array.isArray(content) ? (content as ContentBlock[]) : []
}

function mapAssistant(obj: Record<string, unknown>): AgentEvent[] {
  const events: AgentEvent[] = []
  for (const block of contentOf(obj)) {
    if (block.type === 'text' && block.text) {
      events.push({ kind: 'assistant-text', text: block.text })
    } else if (block.type === 'thinking' && block.thinking) {
      events.push({ kind: 'assistant-thinking', text: block.thinking })
    } else if (block.type === 'tool_use' && block.name) {
      const input = block.input ?? {}
      events.push({
        kind: 'tool-call',
        toolCallId: String(block.id ?? ''),
        name: block.name,
        summary: summarizeTool(block.name, input)
      })
      const fileChange = fileChangeFor(block.name, input)
      if (fileChange) events.push(fileChange)
    }
  }
  return events
}

function mapUserToolResults(obj: Record<string, unknown>): AgentEvent[] {
  const events: AgentEvent[] = []
  for (const block of contentOf(obj)) {
    if (block.type === 'tool_result') {
      events.push({
        kind: 'tool-result',
        toolCallId: String(block.tool_use_id ?? ''),
        isError: block.is_error === true,
        summary: firstText(block.content)
      })
    }
  }
  return events
}

function mapResult(obj: Record<string, unknown>): AgentEvent[] {
  const events: AgentEvent[] = []
  const denials = obj.permission_denials
  if (Array.isArray(denials)) {
    for (const d of denials) {
      const rec = d as { tool_name?: string; toolName?: string }
      events.push({
        kind: 'permission-request',
        tool: String(rec.tool_name ?? rec.toolName ?? 'a tool'),
        detail: 'Claude Code needed permission and the action was blocked.'
      })
    }
  }
  events.push({
    kind: 'completed',
    isError: obj.is_error === true,
    result: typeof obj.result === 'string' ? obj.result : undefined,
    costUsd: typeof obj.total_cost_usd === 'number' ? obj.total_cost_usd : undefined,
    durationMs: typeof obj.duration_ms === 'number' ? obj.duration_ms : undefined
  })
  return events
}

function summarizeTool(name: string, input: Record<string, unknown>): string {
  const filePath = input.file_path ?? input.path ?? input.notebook_path
  if (typeof filePath === 'string') return `${name} ${filePath}`
  if (name === 'Bash' && typeof input.command === 'string') {
    const cmd = input.command.replace(/\s+/g, ' ').trim()
    return `Bash: ${cmd.length > 80 ? cmd.slice(0, 80) + '…' : cmd}`
  }
  if (typeof input.pattern === 'string') return `${name} ${input.pattern}`
  return name
}

function fileChangeFor(
  name: string,
  input: Record<string, unknown>
): Extract<AgentEvent, { kind: 'file-change' }> | null {
  const p = input.file_path ?? input.notebook_path
  if (typeof p !== 'string') return null
  if (name === 'Write') return { kind: 'file-change', path: p, changeType: 'created' }
  if (EDIT_TOOLS.has(name)) return { kind: 'file-change', path: p, changeType: 'modified' }
  return null
}

/** Extract a short human-readable summary from a tool_result content payload. */
function firstText(content: unknown): string {
  if (typeof content === 'string') return truncate(content)
  if (Array.isArray(content)) {
    for (const b of content) {
      const block = b as ContentBlock
      if (block.type === 'text' && typeof block.text === 'string') return truncate(block.text)
    }
  }
  return ''
}

function truncate(s: string): string {
  const oneLine = s.replace(/\s+/g, ' ').trim()
  return oneLine.length > 120 ? oneLine.slice(0, 120) + '…' : oneLine
}
