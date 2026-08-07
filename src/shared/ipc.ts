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

  // AI streaming events (main -> renderer, per request id)
  aiChatDelta: 'ai:chatDelta',
  aiChatDone: 'ai:chatDone',
  aiChatError: 'ai:chatError'
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
