import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type BlameInfo,
  type CommitInfo,
  type DirEntry,
  type GitBranches,
  type GitResult,
  type GitStatus,
  type OpenFolderResult,
  type ProjectHealth,
  type EnvToolStatus,
  type PickFileFilter,
  type PickFileResult,
  type WindowEffect,
  type ShellInfo,
  type TerminalCreateRequest,
  type TerminalDataEvent,
  type TerminalExitEvent,
  type SnapshotMeta,
  type SnapshotResult
} from '@shared/ipc'
import type {
  AgentEventEnvelope,
  AgentSession,
  AgentSessionUpdate,
  ProviderStatus,
  SessionOptions
} from '@shared/agent'
import type { UsageStatus } from '@shared/usage'
import type { ImpactResult, ProjectBrain, WatcherFinding } from '@shared/brain'
import type { AvailableScripts, VerifyResult, VerifyScript } from '@shared/engine'
import type { ScaffoldPlan, ScaffoldResult } from '@shared/create'

/**
 * contextBridge surface. This is the *only* thing the renderer can touch in the
 * main process — a deliberately small, typed API. No raw ipcRenderer, no Node.
 */
const api = {
  fs: {
    openFolder: (): Promise<OpenFolderResult | null> => ipcRenderer.invoke(IPC.fsOpenFolder),
    readDir: (path: string): Promise<DirEntry[]> => ipcRenderer.invoke(IPC.fsReadDir, path),
    readFile: (path: string): Promise<string> => ipcRenderer.invoke(IPC.fsReadFile, path),
    writeFile: (path: string, content: string): Promise<void> =>
      ipcRenderer.invoke(IPC.fsWriteFile, path, content),
    pickFile: (filters: PickFileFilter[], withContent = false): Promise<PickFileResult | null> =>
      ipcRenderer.invoke(IPC.fsPickFile, filters, withContent)
  },
  window: {
    setEffect: (effect: WindowEffect): Promise<void> =>
      ipcRenderer.invoke(IPC.windowSetEffect, effect)
  },
  terminal: {
    listShells: (): Promise<ShellInfo[]> => ipcRenderer.invoke(IPC.termListShells),
    create: (req: TerminalCreateRequest): Promise<void> =>
      ipcRenderer.invoke(IPC.termCreate, req),
    input: (id: string, data: string): Promise<void> =>
      ipcRenderer.invoke(IPC.termInput, id, data),
    kill: (id: string): Promise<void> => ipcRenderer.invoke(IPC.termKill, id),
    onData: (cb: (e: TerminalDataEvent) => void): (() => void) => {
      const handler = (_: unknown, payload: TerminalDataEvent): void => cb(payload)
      ipcRenderer.on(IPC.termData, handler)
      return () => ipcRenderer.removeListener(IPC.termData, handler)
    },
    onExit: (cb: (e: TerminalExitEvent) => void): (() => void) => {
      const handler = (_: unknown, payload: TerminalExitEvent): void => cb(payload)
      ipcRenderer.on(IPC.termExit, handler)
      return () => ipcRenderer.removeListener(IPC.termExit, handler)
    }
  },
  git: {
    status: (cwd: string): Promise<GitStatus> => ipcRenderer.invoke(IPC.gitStatus, cwd),
    stage: (cwd: string, path: string): Promise<GitResult> =>
      ipcRenderer.invoke(IPC.gitStage, cwd, path),
    unstage: (cwd: string, path: string): Promise<GitResult> =>
      ipcRenderer.invoke(IPC.gitUnstage, cwd, path),
    stageAll: (cwd: string): Promise<GitResult> => ipcRenderer.invoke(IPC.gitStageAll, cwd),
    stagedDiff: (cwd: string): Promise<string> => ipcRenderer.invoke(IPC.gitStagedDiff, cwd),
    workingDiff: (cwd: string): Promise<string> => ipcRenderer.invoke(IPC.gitWorkingDiff, cwd),
    commit: (cwd: string, message: string): Promise<GitResult> =>
      ipcRenderer.invoke(IPC.gitCommit, cwd, message),
    push: (cwd: string): Promise<GitResult> => ipcRenderer.invoke(IPC.gitPush, cwd),
    pull: (cwd: string): Promise<GitResult> => ipcRenderer.invoke(IPC.gitPull, cwd),
    branches: (cwd: string): Promise<GitBranches> => ipcRenderer.invoke(IPC.gitBranches, cwd),
    checkout: (cwd: string, branch: string, create: boolean): Promise<GitResult> =>
      ipcRenderer.invoke(IPC.gitCheckout, cwd, branch, create),
    merge: (cwd: string, branch: string): Promise<GitResult> =>
      ipcRenderer.invoke(IPC.gitMerge, cwd, branch),
    mergeAbort: (cwd: string): Promise<GitResult> => ipcRenderer.invoke(IPC.gitMergeAbort, cwd),
    rebase: (cwd: string, branch: string): Promise<GitResult> =>
      ipcRenderer.invoke(IPC.gitRebase, cwd, branch),
    rebaseContinue: (cwd: string): Promise<GitResult> =>
      ipcRenderer.invoke(IPC.gitRebaseContinue, cwd),
    rebaseAbort: (cwd: string): Promise<GitResult> => ipcRenderer.invoke(IPC.gitRebaseAbort, cwd),
    stash: (cwd: string): Promise<GitResult> => ipcRenderer.invoke(IPC.gitStash, cwd),
    stashPop: (cwd: string): Promise<GitResult> => ipcRenderer.invoke(IPC.gitStashPop, cwd),
    log: (cwd: string): Promise<string[]> => ipcRenderer.invoke(IPC.gitLog, cwd),
    blame: (cwd: string, file: string, line: number): Promise<string> =>
      ipcRenderer.invoke(IPC.gitBlame, cwd, file, line),
    blameInfo: (cwd: string, file: string, line: number): Promise<BlameInfo | null> =>
      ipcRenderer.invoke(IPC.gitBlameInfo, cwd, file, line),
    commitShow: (cwd: string, hash: string): Promise<CommitInfo | null> =>
      ipcRenderer.invoke(IPC.gitCommitShow, cwd, hash),
    fileLog: (cwd: string, file: string): Promise<string[]> =>
      ipcRenderer.invoke(IPC.gitFileLog, cwd, file)
  },
  project: {
    health: (root: string): Promise<ProjectHealth> => ipcRenderer.invoke(IPC.projectHealth, root)
  },
  brain: {
    index: (root: string): Promise<ProjectBrain> => ipcRenderer.invoke(IPC.brainIndex, root),
    get: (root: string): Promise<ProjectBrain | null> => ipcRenderer.invoke(IPC.brainGet, root),
    updateFile: (root: string, path: string): Promise<ProjectBrain | null> =>
      ipcRenderer.invoke(IPC.brainUpdateFile, root, path),
    impact: (root: string, path: string): Promise<ImpactResult | null> =>
      ipcRenderer.invoke(IPC.brainImpact, root, path),
    findings: (root: string): Promise<WatcherFinding[]> =>
      ipcRenderer.invoke(IPC.brainFindings, root),
    dispose: (root: string): Promise<void> => ipcRenderer.invoke(IPC.brainDispose, root)
  },
  env: {
    check: (): Promise<EnvToolStatus[]> => ipcRenderer.invoke(IPC.envCheck)
  },
  agent: {
    listProviders: (): Promise<ProviderStatus[]> => ipcRenderer.invoke(IPC.agentListProviders),
    startSession: (options: SessionOptions): Promise<AgentSession> =>
      ipcRenderer.invoke(IPC.agentStartSession, options),
    sendMessage: (sessionId: string, message: string): Promise<void> =>
      ipcRenderer.invoke(IPC.agentSendMessage, sessionId, message),
    stop: (sessionId: string): Promise<void> => ipcRenderer.invoke(IPC.agentStop, sessionId),
    rename: (sessionId: string, title: string): Promise<void> =>
      ipcRenderer.invoke(IPC.agentRename, sessionId, title),
    dispose: (sessionId: string): Promise<void> => ipcRenderer.invoke(IPC.agentDispose, sessionId),
    onEvent: (cb: (e: AgentEventEnvelope) => void): (() => void) => {
      const handler = (_: unknown, payload: AgentEventEnvelope): void => cb(payload)
      ipcRenderer.on(IPC.agentEvent, handler)
      return () => ipcRenderer.removeListener(IPC.agentEvent, handler)
    },
    onSessionUpdate: (cb: (e: AgentSessionUpdate) => void): (() => void) => {
      const handler = (_: unknown, payload: AgentSessionUpdate): void => cb(payload)
      ipcRenderer.on(IPC.agentSessionUpdate, handler)
      return () => ipcRenderer.removeListener(IPC.agentSessionUpdate, handler)
    }
  },
  verify: {
    scripts: (root: string): Promise<AvailableScripts> =>
      ipcRenderer.invoke(IPC.verifyScripts, root),
    run: (root: string, script: VerifyScript): Promise<VerifyResult> =>
      ipcRenderer.invoke(IPC.verifyRun, root, script)
  },
  create: {
    scaffold: (plan: ScaffoldPlan): Promise<ScaffoldResult> =>
      ipcRenderer.invoke(IPC.scaffoldCreate, plan)
  },
  usage: {
    get: (): Promise<UsageStatus> => ipcRenderer.invoke(IPC.usageGet)
  },
  snapshot: {
    create: (workspace: string, label: string): Promise<SnapshotResult> =>
      ipcRenderer.invoke(IPC.snapshotCreate, workspace, label),
    list: (workspace: string): Promise<SnapshotMeta[]> =>
      ipcRenderer.invoke(IPC.snapshotList, workspace),
    restore: (workspace: string, id: string): Promise<SnapshotResult> =>
      ipcRenderer.invoke(IPC.snapshotRestore, workspace, id),
    delete: (workspace: string, id: string): Promise<SnapshotResult> =>
      ipcRenderer.invoke(IPC.snapshotDelete, workspace, id)
  }
}

export type LumixaApi = typeof api

contextBridge.exposeInMainWorld('lumixa', api)
