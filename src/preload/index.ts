import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type DirEntry,
  type GitBranches,
  type GitResult,
  type GitStatus,
  type OpenFolderResult,
  type PickFileFilter,
  type PickFileResult,
  type WindowEffect,
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
    rebaseAbort: (cwd: string): Promise<GitResult> => ipcRenderer.invoke(IPC.gitRebaseAbort, cwd)
  }
}

export type LumixaApi = typeof api

contextBridge.exposeInMainWorld('lumixa', api)
