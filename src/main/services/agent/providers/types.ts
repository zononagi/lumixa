import type { AgentEvent, PermissionMode, ProviderStatus } from '@shared/agent'

/**
 * Provider abstraction. Every concrete provider (Claude Code today; Claude API,
 * Codex, Gemini, Ollama in future) drives an external process and translates its
 * streaming output into Lumixa's structured {@link AgentEvent}s.
 *
 * Provider-specific knowledge (CLI flags, output protocol) lives here and NEVER
 * in the renderer/UI. The runtime treats all providers identically.
 */

/** How to launch one turn of a conversation as a child process. */
export interface RunSpec {
  command: string
  args: string[]
  cwd: string
  /** Extra env vars to merge onto process.env (never secrets from Lumixa). */
  env?: Record<string, string>
  /** Run via the OS shell (needed for .cmd/.bat shims on Windows). */
  shell?: boolean
}

export interface RunSpecInput {
  message: string
  workspacePath: string
  model?: string
  permissionMode?: PermissionMode
  /** Stable session id Lumixa assigns up front (for --session-id / --resume). */
  sessionId: string
  /** True once the provider has emitted a session-init for this session, so
   *  subsequent turns should resume rather than start fresh. */
  resume: boolean
}

export interface AIProvider {
  readonly id: string
  readonly name: string

  /** Locate the executable + report install/auth/version state. Never throws. */
  detect(): Promise<ProviderStatus>

  /** Build the child-process invocation for a single user message. */
  createRunSpec(input: RunSpecInput): RunSpec

  /**
   * Parse one line of the provider's streaming stdout into zero or more events.
   * Must be side-effect free and tolerant of malformed/partial lines.
   */
  parseLine(line: string): AgentEvent[]
}
