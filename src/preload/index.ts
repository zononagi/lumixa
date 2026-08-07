import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type ChatDeltaEvent,
  type ChatDoneEvent,
  type ChatErrorEvent,
  type ChatStartRequest,
  type CompleteRequest,
  type CompleteResult,
  type DirEntry,
  type GitBranches,
  type GitResult,
  type GitStatus,
  type ModelInfo,
  type OpenFolderResult,
  type ProviderId,
  type ShellInfo,
  type TerminalCreateRequest,
  type TerminalDataEvent,
  type TerminalExitEvent
} from '@shared/ipc'

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
      ipcRenderer.invoke(IPC.fsWriteFile, path, content)
  },
  secrets: {
    set: (provider: ProviderId, key: string): Promise<void> =>
      ipcRenderer.invoke(IPC.secretsSet, provider, key),
    has: (provider: ProviderId): Promise<boolean> =>
      ipcRenderer.invoke(IPC.secretsGet, provider),
    list: (): Promise<ProviderId[]> => ipcRenderer.invoke(IPC.secretsList)
  },
  ai: {
    listModels: (): Promise<ModelInfo[]> => ipcRenderer.invoke(IPC.aiListModels),
    startChat: (req: ChatStartRequest): Promise<void> =>
      ipcRenderer.invoke(IPC.aiChatStart, req),
    cancelChat: (requestId: string): Promise<void> =>
      ipcRenderer.invoke(IPC.aiChatCancel, requestId),
    complete: (req: CompleteRequest): Promise<CompleteResult> =>
      ipcRenderer.invoke(IPC.aiComplete, req),

    // Subscriptions return an unsubscribe function.
    onDelta: (cb: (e: ChatDeltaEvent) => void): (() => void) => {
      const handler = (_: unknown, payload: ChatDeltaEvent): void => cb(payload)
      ipcRenderer.on(IPC.aiChatDelta, handler)
      return () => ipcRenderer.removeListener(IPC.aiChatDelta, handler)
    },
    onDone: (cb: (e: ChatDoneEvent) => void): (() => void) => {
      const handler = (_: unknown, payload: ChatDoneEvent): void => cb(payload)
      ipcRenderer.on(IPC.aiChatDone, handler)
      return () => ipcRenderer.removeListener(IPC.aiChatDone, handler)
    },
    onError: (cb: (e: ChatErrorEvent) => void): (() => void) => {
      const handler = (_: unknown, payload: ChatErrorEvent): void => cb(payload)
      ipcRenderer.on(IPC.aiChatError, handler)
      return () => ipcRenderer.removeListener(IPC.aiChatError, handler)
    }
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
    commit: (cwd: string, message: string): Promise<GitResult> =>
      ipcRenderer.invoke(IPC.gitCommit, cwd, message),
    push: (cwd: string): Promise<GitResult> => ipcRenderer.invoke(IPC.gitPush, cwd),
    pull: (cwd: string): Promise<GitResult> => ipcRenderer.invoke(IPC.gitPull, cwd),
    branches: (cwd: string): Promise<GitBranches> => ipcRenderer.invoke(IPC.gitBranches, cwd),
    checkout: (cwd: string, branch: string, create: boolean): Promise<GitResult> =>
      ipcRenderer.invoke(IPC.gitCheckout, cwd, branch, create)
  },
  project: {
    context: (root: string): Promise<string> => ipcRenderer.invoke(IPC.projectContext, root)
  }
}

export type LumixaApi = typeof api

contextBridge.exposeInMainWorld('lumixa', api)
