/**
 * Shared agent-runtime contract between main and renderer.
 *
 * Lumixa does NOT implement any AI provider itself. It drives an external agent
 * CLI (currently the user's already-installed & already-authenticated Claude Code)
 * as a child process and surfaces its output as structured events. This file is
 * dependency-free — types and constants only.
 */

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------

/** Lifecycle state of an external agent CLI, from Lumixa's point of view. */
export type ProviderState =
  | 'not-installed'
  | 'installed' // present but auth state unknown
  | 'authenticated'
  | 'unauthenticated'
  | 'error'

/** How well Lumixa understands the detected CLI version. */
export type Compatibility = 'supported' | 'unknown'

export interface ProviderStatus {
  id: string
  name: string
  state: ProviderState
  /** CLI version string, when the executable was found. */
  version?: string
  compatibility?: Compatibility
  /** Absolute path to the resolved executable, when found. */
  executablePath?: string
  /** Short, beginner-friendly explanation of the current state (never a raw stack trace). */
  detail?: string
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export type SessionStatus =
  | 'idle'
  | 'starting'
  | 'working'
  | 'waiting-permission'
  | 'completed'
  | 'error'

/** Permission posture handed to the CLI. Lumixa does not reimplement the CLI's
 *  own permission engine — this only selects which built-in mode it runs in. */
export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions'

export interface SessionOptions {
  providerId: string
  workspacePath: string
  /** Optional model alias/full name; omitted = CLI default. */
  model?: string
  permissionMode?: PermissionMode
}

export interface AgentSession {
  id: string
  providerId: string
  workspacePath: string
  status: SessionStatus
  title: string
  createdAt: number
  updatedAt: number
}

// ---------------------------------------------------------------------------
// Structured agent events (parsed from the provider's streaming output)
// ---------------------------------------------------------------------------

export type FileChangeType = 'created' | 'modified' | 'deleted'

export type AgentEvent =
  | {
      kind: 'session-init'
      /** The provider's own session id (used for resume/continuity). */
      providerSessionId: string
      model: string
      cwd: string
      version: string
    }
  | { kind: 'assistant-text'; text: string }
  | { kind: 'assistant-thinking'; text: string }
  | { kind: 'tool-call'; toolCallId: string; name: string; summary: string }
  | { kind: 'tool-result'; toolCallId: string; isError: boolean; summary: string }
  | { kind: 'file-change'; path: string; changeType: FileChangeType }
  | { kind: 'permission-request'; tool: string; detail: string }
  | { kind: 'progress'; label: string }
  | { kind: 'error'; message: string; friendly: string }
  | {
      kind: 'completed'
      isError: boolean
      result?: string
      costUsd?: number
      durationMs?: number
    }

// ---------------------------------------------------------------------------
// IPC payloads (main -> renderer streaming)
// ---------------------------------------------------------------------------

export interface AgentEventEnvelope {
  sessionId: string
  event: AgentEvent
}

export interface AgentSessionUpdate {
  session: AgentSession
}
