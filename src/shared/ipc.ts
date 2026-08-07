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
  fsPickFile: 'fs:pickFile',

  // Window appearance (Windows 11 Mica/Acrylic)
  windowSetEffect: 'window:setEffect',

  // Account linking (OAuth) — replaces API keys entirely.
  authStatus: 'auth:status', // -> AuthAccount[]
  authLogin: 'auth:login', // start the OAuth flow for a provider
  authSubmitCode: 'auth:submitCode', // paste-flow: hand back the authorization code
  authLogout: 'auth:logout', // sign out / forget tokens for a provider

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
  termExit: 'term:exit', // main -> renderer

  // Git
  gitStatus: 'git:status',
  gitStage: 'git:stage',
  gitUnstage: 'git:unstage',
  gitStageAll: 'git:stageAll',
  gitStagedDiff: 'git:stagedDiff',
  gitCommit: 'git:commit',
  gitPush: 'git:push',
  gitPull: 'git:pull',
  gitBranches: 'git:branches',
  gitCheckout: 'git:checkout',
  gitMerge: 'git:merge',
  gitMergeAbort: 'git:mergeAbort',
  gitRebase: 'git:rebase',
  gitRebaseContinue: 'git:rebaseContinue',
  gitRebaseAbort: 'git:rebaseAbort',

  // Project context / memory
  projectContext: 'project:context'
} as const

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type ProviderId = 'anthropic' | 'openai'

// ---------------------------------------------------------------------------
// Account linking (OAuth)
// ---------------------------------------------------------------------------

/** Connection state for one provider, surfaced to the renderer (never tokens). */
export interface AuthAccount {
  provider: ProviderId
  connected: boolean
  /** Human-friendly label for the linked account (email / plan), when known. */
  label?: string
}

/**
 * Result of starting a login. `needsCode` is true for providers whose OAuth
 * redirect can't be captured automatically (Anthropic): the browser shows an
 * authorization code the user pastes back via `auth:submitCode`. Loopback
 * providers (OpenAI) resolve straight to `ok` once the browser round-trip ends.
 */
export interface LoginResult {
  ok: boolean
  needsCode?: boolean
  error?: string
}

export interface AuthResult {
  ok: boolean
  error?: string
}

export interface DirEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface OpenFolderResult {
  root: string
  name: string
}

/** Windows 11 system backdrop material. 'none' = opaque (default). */
export type WindowEffect = 'none' | 'mica' | 'acrylic'

export interface PickFileFilter {
  name: string
  extensions: string[]
}

export interface PickFileResult {
  path: string
  /** UTF-8 content, included only when `withContent` was requested. */
  content?: string
  /** A `lumixa-media://` URL usable directly as an <img>/<video> src. */
  mediaUrl: string
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

// --- Git ---
export interface GitFile {
  path: string
  /** Index (staged) status code, e.g. 'M', 'A', 'D', ' '. */
  index: string
  /** Working-tree status code. */
  work: string
  staged: boolean
}

export interface GitStatus {
  isRepo: boolean
  branch: string
  ahead: number
  behind: number
  files: GitFile[]
  /** Set when a merge or rebase is mid-flight (conflicts to resolve). */
  operation?: 'merge' | 'rebase'
  error?: string
}

export interface GitBranches {
  current: string
  all: string[]
}

export interface GitResult {
  ok: boolean
  output: string
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
