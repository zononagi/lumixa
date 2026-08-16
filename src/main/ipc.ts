import { app, ipcMain, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { IPC, type TerminalCreateRequest } from '@shared/ipc'
import type { SessionOptions } from '@shared/agent'
import { openFolderDialog, readDir, readFile, writeFile, pickFile } from './services/fs'
import {
  createSnapshot,
  deleteSnapshot,
  listSnapshots,
  restoreSnapshot
} from './services/snapshot'
import {
  createTerminal,
  killTerminal,
  listShells,
  writeTerminal
} from './services/terminal'
import * as git from './services/git'
import { buildProjectHealth } from './services/projectHealth'
import {
  analyzeImpact,
  disposeBrain,
  getBrain,
  getFindings,
  indexProject,
  updateFile as brainUpdateFile
} from './services/brain/projectBrain'
import { checkEnvironment } from './services/environment'
import { listScripts, runScript } from './services/verify'
import type { VerifyScript } from '@shared/engine'
import { scaffold } from './services/scaffold'
import type { ScaffoldPlan } from '@shared/create'
import { AgentRuntime } from './services/agent/runtime'
import { getUsage, ingestUsageLine } from './services/agent/usage'

let runtime: AgentRuntime | null = null

/** Kill all agent sessions on shutdown so no Claude Code process is orphaned. */
export function disposeAgents(): void {
  runtime?.disposeAll()
  runtime = null
}

/**
 * Registers every IPC handler on the main process. Called once after the main
 * window is created so streaming events can be pushed to `win.webContents`.
 */
export function registerIpcHandlers(win: BrowserWindow): void {
  // --- Filesystem -----------------------------------------------------------
  ipcMain.handle(IPC.fsOpenFolder, () => openFolderDialog())
  ipcMain.handle(IPC.fsReadDir, (_e, dirPath: string) => readDir(dirPath))
  ipcMain.handle(IPC.fsReadFile, (_e, filePath: string) => readFile(filePath))
  ipcMain.handle(IPC.fsWriteFile, (_e, filePath: string, content: string) =>
    writeFile(filePath, content)
  )
  ipcMain.handle(IPC.fsPickFile, (_e, filters, withContent: boolean) =>
    pickFile(filters, withContent)
  )

  // --- Window appearance (Windows 11 Mica / Acrylic) ------------------------
  ipcMain.handle(IPC.windowSetEffect, (_e, effect: 'none' | 'mica' | 'acrylic') => {
    if (win.isDestroyed()) return
    if (process.platform !== 'win32') return // Mica/Acrylic are Windows 11 only.
    if (effect === 'none') {
      win.setBackgroundMaterial('none')
      win.setBackgroundColor('#1e1e1e')
    } else {
      // A transparent background lets the system material show through.
      win.setBackgroundColor('#00000000')
      win.setBackgroundMaterial(effect)
    }
  })

  // --- Terminal -------------------------------------------------------------
  ipcMain.handle(IPC.termListShells, () => listShells())

  ipcMain.handle(IPC.termCreate, (_e, req: TerminalCreateRequest) => {
    const send = (channel: string, payload: unknown): void => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload)
    }
    createTerminal(
      req,
      (data) => send(IPC.termData, { id: req.id, data }),
      (code) => send(IPC.termExit, { id: req.id, code })
    )
  })

  ipcMain.handle(IPC.termInput, (_e, id: string, data: string) => writeTerminal(id, data))
  ipcMain.handle(IPC.termKill, (_e, id: string) => killTerminal(id))

  // --- Git ------------------------------------------------------------------
  ipcMain.handle(IPC.gitStatus, (_e, cwd: string) => git.status(cwd))
  ipcMain.handle(IPC.gitStage, (_e, cwd: string, path: string) => git.stage(cwd, path))
  ipcMain.handle(IPC.gitUnstage, (_e, cwd: string, path: string) => git.unstage(cwd, path))
  ipcMain.handle(IPC.gitStageAll, (_e, cwd: string) => git.stageAll(cwd))
  ipcMain.handle(IPC.gitStagedDiff, (_e, cwd: string) => git.stagedDiff(cwd))
  ipcMain.handle(IPC.gitWorkingDiff, (_e, cwd: string) => git.workingDiff(cwd))
  ipcMain.handle(IPC.gitCommit, (_e, cwd: string, message: string) => git.commit(cwd, message))
  ipcMain.handle(IPC.gitPush, (_e, cwd: string) => git.push(cwd))
  ipcMain.handle(IPC.gitPull, (_e, cwd: string) => git.pull(cwd))
  ipcMain.handle(IPC.gitBranches, (_e, cwd: string) => git.branches(cwd))
  ipcMain.handle(IPC.gitCheckout, (_e, cwd: string, branch: string, create: boolean) =>
    git.checkout(cwd, branch, create)
  )
  ipcMain.handle(IPC.gitMerge, (_e, cwd: string, branch: string) => git.merge(cwd, branch))
  ipcMain.handle(IPC.gitMergeAbort, (_e, cwd: string) => git.mergeAbort(cwd))
  ipcMain.handle(IPC.gitRebase, (_e, cwd: string, branch: string) => git.rebase(cwd, branch))
  ipcMain.handle(IPC.gitRebaseContinue, (_e, cwd: string) => git.rebaseContinue(cwd))
  ipcMain.handle(IPC.gitRebaseAbort, (_e, cwd: string) => git.rebaseAbort(cwd))
  ipcMain.handle(IPC.gitStash, (_e, cwd: string) => git.stash(cwd))
  ipcMain.handle(IPC.gitStashPop, (_e, cwd: string) => git.stashPop(cwd))
  ipcMain.handle(IPC.gitLog, (_e, cwd: string) => git.log(cwd))
  ipcMain.handle(IPC.gitBlame, (_e, cwd: string, file: string, line: number) =>
    git.blame(cwd, file, line)
  )
  ipcMain.handle(IPC.gitBlameInfo, (_e, cwd: string, file: string, line: number) =>
    git.blameInfo(cwd, file, line)
  )
  ipcMain.handle(IPC.gitCommitShow, (_e, cwd: string, hash: string) => git.commitShow(cwd, hash))
  ipcMain.handle(IPC.gitFileLog, (_e, cwd: string, file: string) => git.fileLog(cwd, file))

  // --- Project intelligence -------------------------------------------------
  ipcMain.handle(IPC.projectHealth, (_e, root: string) => buildProjectHealth(root))

  // --- Project Brain (Autonomous Development Engine) ------------------------
  ipcMain.handle(IPC.brainIndex, (_e, root: string) => indexProject(root))
  ipcMain.handle(IPC.brainGet, (_e, root: string) => getBrain(root))
  ipcMain.handle(IPC.brainUpdateFile, (_e, root: string, path: string) =>
    brainUpdateFile(root, path)
  )
  ipcMain.handle(IPC.brainImpact, (_e, root: string, path: string) => analyzeImpact(root, path))
  ipcMain.handle(IPC.brainFindings, (_e, root: string) => getFindings(root))
  ipcMain.handle(IPC.brainDispose, (_e, root: string) => disposeBrain(root))

  // --- Environment Doctor ---------------------------------------------------
  ipcMain.handle(IPC.envCheck, () => checkEnvironment())

  // --- Self-Healing verification runner ------------------------------------
  ipcMain.handle(IPC.verifyScripts, (_e, root: string) => listScripts(root))
  ipcMain.handle(IPC.verifyRun, (_e, root: string, script: VerifyScript) => runScript(root, script))

  // --- Project Creation Engine ---------------------------------------------
  ipcMain.handle(IPC.scaffoldCreate, (_e, plan: ScaffoldPlan) => scaffold(plan))

  // --- AI agent runtime (external Claude Code CLI) --------------------------
  const send = (channel: string, payload: unknown): void => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
  runtime = new AgentRuntime({
    event: (sessionId, event) => send(IPC.agentEvent, { sessionId, event }),
    sessionUpdate: (session) => send(IPC.agentSessionUpdate, { session }),
    // Harvest official rate-limit signals from real runs for the usage monitor.
    rawLine: (line) => ingestUsageLine(line)
  })

  ipcMain.handle(IPC.agentListProviders, () => runtime!.listProviders())
  ipcMain.handle(IPC.agentStartSession, (_e, options: SessionOptions) =>
    runtime!.startSession(options)
  )
  ipcMain.handle(IPC.agentSendMessage, (_e, sessionId: string, message: string) =>
    runtime!.sendMessage(sessionId, message)
  )
  ipcMain.handle(IPC.agentStop, (_e, sessionId: string) => runtime!.stop(sessionId))
  ipcMain.handle(IPC.agentRename, (_e, sessionId: string, title: string) =>
    runtime!.rename(sessionId, title)
  )
  ipcMain.handle(IPC.agentDispose, (_e, sessionId: string) => runtime!.dispose(sessionId))

  // --- Usage monitor --------------------------------------------------------
  ipcMain.handle(IPC.usageGet, () => getUsage())

  // --- Safe Mode snapshots --------------------------------------------------
  // Stored under the app's per-user data dir, keyed by workspace — never inside
  // the workspace itself, so snapshots can't pollute the project or Git.
  const snapshotsRoot = join(app.getPath('userData'), 'snapshots')
  ipcMain.handle(IPC.snapshotCreate, (_e, workspace: string, label: string) =>
    createSnapshot(snapshotsRoot, workspace, label)
  )
  ipcMain.handle(IPC.snapshotList, (_e, workspace: string) =>
    listSnapshots(snapshotsRoot, workspace)
  )
  ipcMain.handle(IPC.snapshotRestore, (_e, workspace: string, id: string) =>
    restoreSnapshot(snapshotsRoot, workspace, id)
  )
  ipcMain.handle(IPC.snapshotDelete, (_e, workspace: string, id: string) =>
    deleteSnapshot(snapshotsRoot, workspace, id)
  )
}
