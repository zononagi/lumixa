/**
 * Shared IPC contract between the main and renderer processes.
 *
 * This file is the single source of truth for the typed boundary. It is imported
 * by both `src/main` (Node/Electron) and `src/renderer` (browser) so the two sides
 * can never drift. Keep it dependency-free — types and constants only.
 */

// ---------------------------------------------------------------------------
// Channel names
// ---------------------------------------------------------------------------

export const IPC = {
  // Filesystem / workspace
  fsOpenFolder: 'fs:openFolder',
  fsReadDir: 'fs:readDir',
  fsReadFile: 'fs:readFile',
  fsWriteFile: 'fs:writeFile',

  // Secure secrets (API keys, per provider)
  secretsGet: 'secrets:get',
  secretsSet: 'secrets:set',
  secretsList: 'secrets:list',

  // AI providers
  aiListModels: 'ai:listModels',
  aiChatStart: 'ai:chatStart',
  aiChatCancel: 'ai:chatCancel',
  aiComplete: 'ai:complete', // one-shot, returns the full response text

  // AI streaming events (main -> renderer, per request id)
  aiChatDelta: 'ai:chatDelta',
  aiChatDone: 'ai:chatDone',
  aiChatError: 'ai:chatError',

  // Terminal
  termListShells: 'term:listShells',
  termCreate: 'term:create',
  termInput: 'term:input',
  termResize: 'term:resize',
  termKill: 'term:kill',
  termData: 'term:data', // main -> renderer
  termExit: 'term:exit' // main -> renderer
} as const

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'ollama'

export interface DirEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface OpenFolderResult {
  root: string
  name: string
}

export interface ModelInfo {
  id: string
  displayName: string
  provider: ProviderId
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatStartRequest {
  requestId: string
  provider: ProviderId
  model: string
  system?: string
  messages: ChatMessage[]
}

export interface CompleteRequest {
  provider: ProviderId
  model: string
  system?: string
  messages: ChatMessage[]
}

export interface CompleteResult {
  text: string
  error?: string
}

// --- Terminal ---
export interface ShellInfo {
  id: string
  label: string
  /** Absolute path or command name of the shell executable. */
  path: string
}

export interface TerminalCreateRequest {
  id: string
  shellPath: string
  cwd?: string
  cols: number
  rows: number
}

export interface TerminalDataEvent {
  id: string
  data: string
}

export interface TerminalExitEvent {
  id: string
  code: number | null
}

// Streaming event payloads (main -> renderer)
export interface ChatDeltaEvent {
  requestId: string
  text: string
}

export interface ChatDoneEvent {
  requestId: string
  inputTokens?: number
  outputTokens?: number
}

export interface ChatErrorEvent {
  requestId: string
  message: string
}
