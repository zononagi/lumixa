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
  gitWorkingDiff: 'git:workingDiff',
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
  gitStash: 'git:stash',
  gitStashPop: 'git:stashPop',
  gitLog: 'git:log',
  gitBlame: 'git:blame',

  // Project intelligence (dependency + health scan)
  projectHealth: 'project:health',

  // Project Brain (Autonomous Development Engine — structural understanding)
  brainIndex: 'brain:index',
  brainGet: 'brain:get',
  brainUpdateFile: 'brain:updateFile',
  brainImpact: 'brain:impact',
  brainDispose: 'brain:dispose',

  // Environment Doctor (detect installed dev tools)
  envCheck: 'env:check',

  // AI agent runtime (external Claude Code CLI wrapper)
  agentListProviders: 'agent:listProviders',
  agentStartSession: 'agent:startSession',
  agentSendMessage: 'agent:sendMessage',
  agentStop: 'agent:stop',
  agentRename: 'agent:rename',
  agentDispose: 'agent:dispose',
  agentEvent: 'agent:event', // main -> renderer (streaming AgentEvent)
  agentSessionUpdate: 'agent:sessionUpdate', // main -> renderer (session status changes)

  // Usage monitor
  usageGet: 'usage:get',

  // Safe Mode — project snapshots (a temporary safety net, NOT a Git replacement)
  snapshotCreate: 'snapshot:create',
  snapshotList: 'snapshot:list',
  snapshotRestore: 'snapshot:restore',
  snapshotDelete: 'snapshot:delete'
} as const

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

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

// --- Project intelligence ---
export interface DependencyInfo {
  name: string
  version: string
  dev: boolean
  /** Number of project files that import this package (best-effort). */
  usedBy: number
}

export interface ProjectHealth {
  isProject: boolean
  name?: string
  fileCount: number
  dependencies: DependencyInfo[]
  /** Declared deps that no file appears to import. */
  unusedDependencies: string[]
  /** Bare imports with no matching dependency (best-effort; excludes builtins). */
  missingDependencies: string[]
  error?: string
}

// --- Environment Doctor ---
export interface EnvToolStatus {
  id: string
  name: string
  installed: boolean
  version?: string
  /** Beginner explanation of what the tool is (bilingual; caller picks). */
  whatJa: string
  whatEn: string
}

// --- Safe Mode snapshots ---
export interface SnapshotMeta {
  id: string
  createdAt: number
  /** Absolute workspace path this snapshot belongs to. */
  workspace: string
  /** User-supplied label, or an automatic reason (e.g. "Before restore"). */
  label: string
  fileCount: number
  /** True when Lumixa created it automatically (e.g. the pre-restore safety net). */
  auto: boolean
}

export interface SnapshotResult {
  ok: boolean
  /** Beginner-friendly outcome message (never a raw stack trace). */
  message: string
  meta?: SnapshotMeta
}
