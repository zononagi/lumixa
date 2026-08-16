import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import type {
  AgentEvent,
  AgentSession,
  ProviderStatus,
  SessionOptions,
  SessionStatus
} from '@shared/agent'
import { AgentProcess } from './process'
import type { AIProvider } from './providers/types'
import { ClaudeCodeProvider } from './providers/claudeCode'

/**
 * Central agent runtime. Owns the provider registry and every live session,
 * and turns a user message into a child-process run whose streaming output is
 * dispatched to the renderer as structured events.
 *
 * Provider-specific behavior lives entirely in the providers; this class is
 * generic and would drive Codex/Gemini/Ollama identically.
 */

interface SessionRecord {
  session: AgentSession
  provider: AIProvider
  options: SessionOptions
  hasRun: boolean
  proc: AgentProcess | null
}

export interface RuntimeEmitter {
  event: (sessionId: string, event: AgentEvent) => void
  sessionUpdate: (session: AgentSession) => void
  /** Optional sink for raw NDJSON lines (used by the usage monitor). */
  rawLine?: (line: string) => void
}

export class AgentRuntime {
  private readonly providers = new Map<string, AIProvider>()
  private readonly sessions = new Map<string, SessionRecord>()

  constructor(private readonly emit: RuntimeEmitter) {
    this.register(new ClaudeCodeProvider())
  }

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider)
  }

  /** Detect all registered providers; the UI only offers usable ones. */
  async listProviders(): Promise<ProviderStatus[]> {
    return Promise.all([...this.providers.values()].map((p) => p.detect()))
  }

  async startSession(options: SessionOptions): Promise<AgentSession> {
    const provider = this.providers.get(options.providerId)
    if (!provider) throw new Error(`Unknown provider: ${options.providerId}`)
    if (!options.workspacePath || !existsSync(options.workspacePath)) {
      throw new Error('Open a workspace folder before starting an agent session.')
    }
    const now = Date.now()
    const session: AgentSession = {
      id: randomUUID(),
      providerId: provider.id,
      workspacePath: options.workspacePath,
      status: 'idle',
      title: 'New session',
      createdAt: now,
      updatedAt: now
    }
    this.sessions.set(session.id, { session, provider, options, hasRun: false, proc: null })
    return session
  }

  sendMessage(sessionId: string, message: string): void {
    const rec = this.sessions.get(sessionId)
    if (!rec) throw new Error('Session not found')
    if (rec.proc) throw new Error('The agent is already working on this session.')

    if (rec.session.title === 'New session') {
      rec.session.title = message.slice(0, 48) || 'New session'
    }
    this.setStatus(rec, 'starting')

    const spec = rec.provider.createRunSpec({
      message,
      workspacePath: rec.options.workspacePath,
      model: rec.options.model,
      permissionMode: rec.options.permissionMode,
      sessionId: rec.session.id,
      resume: rec.hasRun
    })

    let sawCompleted = false
    let stderrTail = ''

    const proc = new AgentProcess(
      { command: spec.command, args: spec.args, cwd: spec.cwd, env: spec.env, shell: spec.shell },
      {
        onLine: (line) => {
          this.emit.rawLine?.(line)
          for (const ev of rec.provider.parseLine(line)) {
            if (ev.kind === 'session-init') this.setStatus(rec, 'working')
            if (ev.kind === 'completed') {
              sawCompleted = true
              this.setStatus(rec, ev.isError ? 'error' : 'completed')
            }
            this.emit.event(sessionId, ev)
          }
        },
        onStderr: (chunk) => {
          stderrTail = (stderrTail + chunk).slice(-2000)
        },
        onClose: ({ code, killed, timedOut }) => {
          rec.proc = null
          rec.hasRun = true
          if (sawCompleted) return
          // No structured result arrived — synthesize a friendly error.
          const ev = closeToEvent(code, killed, timedOut, stderrTail)
          this.setStatus(rec, killed && !timedOut ? 'idle' : 'error')
          this.emit.event(sessionId, ev)
        }
      }
    )
    rec.proc = proc
    proc.start()
  }

  stop(sessionId: string): void {
    const rec = this.sessions.get(sessionId)
    rec?.proc?.kill()
  }

  /** Give a session a user-chosen title. Purely cosmetic; never touches the CLI. */
  rename(sessionId: string, title: string): void {
    const rec = this.sessions.get(sessionId)
    if (!rec) return
    rec.session.title = title.trim().slice(0, 80) || rec.session.title
    rec.session.updatedAt = Date.now()
    this.emit.sessionUpdate({ ...rec.session })
  }

  dispose(sessionId: string): void {
    const rec = this.sessions.get(sessionId)
    if (!rec) return
    rec.proc?.kill()
    this.sessions.delete(sessionId)
  }

  /** Kill every running session — called on app shutdown to avoid orphans. */
  disposeAll(): void {
    for (const [, rec] of this.sessions) rec.proc?.kill()
    this.sessions.clear()
  }

  private setStatus(rec: SessionRecord, status: SessionStatus): void {
    rec.session.status = status
    rec.session.updatedAt = Date.now()
    this.emit.sessionUpdate({ ...rec.session })
  }
}

function closeToEvent(
  code: number | null,
  killed: boolean,
  timedOut: boolean,
  stderrTail: string
): AgentEvent {
  if (timedOut) {
    return {
      kind: 'error',
      message: `timeout (stderr: ${stderrTail})`,
      friendly: 'The agent took too long and was stopped. You can try again.'
    }
  }
  if (killed) {
    return { kind: 'completed', isError: false, result: undefined }
  }
  const friendly =
    code === 0
      ? 'The agent finished without a final result.'
      : `Claude Code exited unexpectedly (code ${code ?? 'unknown'}). This can happen if the request was interrupted. You can try again.`
  return { kind: 'error', message: `exit ${code}: ${stderrTail}`, friendly }
}
