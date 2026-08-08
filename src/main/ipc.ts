import { ipcMain, type BrowserWindow } from 'electron'
import { IPC, type TerminalCreateRequest } from '@shared/ipc'
import { openFolderDialog, readDir, readFile, writeFile, pickFile } from './services/fs'
import {
  createTerminal,
  killTerminal,
  listShells,
  writeTerminal
} from './services/terminal'
import * as git from './services/git'
import { buildProjectHealth } from './services/projectHealth'

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

  // --- Project intelligence -------------------------------------------------
  ipcMain.handle(IPC.projectHealth, (_e, root: string) => buildProjectHealth(root))
}
