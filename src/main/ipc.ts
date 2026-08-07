import { ipcMain, type BrowserWindow } from 'electron'
import {
  IPC,
  type ChatStartRequest,
  type CompleteRequest,
  type CompleteResult,
  type ModelInfo,
  type ProviderId,
  type TerminalCreateRequest
} from '@shared/ipc'
import { openFolderDialog, readDir, readFile, writeFile } from './services/fs'
import { getSecret, setSecret, listConfiguredProviders } from './services/secrets'
import { getProvider, registeredProviderIds } from './ai/registry'
import {
  createTerminal,
  killTerminal,
  listShells,
  writeTerminal
} from './services/terminal'
import * as git from './services/git'
import { buildProjectContext } from './services/projectContext'

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

  // --- Secrets --------------------------------------------------------------
  ipcMain.handle(IPC.secretsSet, (_e, provider: ProviderId, key: string) =>
    setSecret(provider, key)
  )
  ipcMain.handle(IPC.secretsGet, async (_e, provider: ProviderId) => {
    // Renderer only needs to know a key exists, never its value.
    return (await getSecret(provider)) !== null
  })
  ipcMain.handle(IPC.secretsList, () => listConfiguredProviders())

  // --- AI: model discovery --------------------------------------------------
  ipcMain.handle(IPC.aiListModels, async (): Promise<ModelInfo[]> => {
    const configured = await listConfiguredProviders()
    const out: ModelInfo[] = []
    for (const id of registeredProviderIds()) {
      if (!configured.includes(id)) continue // hide unconfigured providers
      const key = await getSecret(id)
      const provider = getProvider(id)
      if (!key || !provider) continue
      out.push(...(await provider.listModels(key)))
    }
    return out
  })

  // --- AI: streaming chat ---------------------------------------------------
  const active = new Map<string, AbortController>()

  ipcMain.handle(IPC.aiChatStart, async (_e, req: ChatStartRequest) => {
    const provider = getProvider(req.provider)
    const key = await getSecret(req.provider)
    const send = (channel: string, payload: unknown): void => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload)
    }

    if (!provider || !key) {
      send(IPC.aiChatError, {
        requestId: req.requestId,
        message: `Provider "${req.provider}" is not configured.`
      })
      return
    }

    const controller = new AbortController()
    active.set(req.requestId, controller)

    await provider.streamChat(
      key,
      { model: req.model, system: req.system, messages: req.messages },
      {
        signal: controller.signal,
        onDelta: (text) => send(IPC.aiChatDelta, { requestId: req.requestId, text }),
        onDone: (usage) => {
          send(IPC.aiChatDone, {
            requestId: req.requestId,
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens
          })
          active.delete(req.requestId)
        },
        onError: (message) => {
          send(IPC.aiChatError, { requestId: req.requestId, message })
          active.delete(req.requestId)
        }
      }
    )
  })

  ipcMain.handle(IPC.aiChatCancel, (_e, requestId: string) => {
    active.get(requestId)?.abort()
    active.delete(requestId)
  })

  // --- AI: one-shot completion (Composer / Inline Edit) ---------------------
  ipcMain.handle(IPC.aiComplete, async (_e, req: CompleteRequest): Promise<CompleteResult> => {
    const provider = getProvider(req.provider)
    const key = await getSecret(req.provider)
    if (!provider || !key) {
      return { text: '', error: `Provider "${req.provider}" is not configured.` }
    }
    return new Promise<CompleteResult>((resolve) => {
      let acc = ''
      const controller = new AbortController()
      void provider.streamChat(
        key,
        { model: req.model, system: req.system, messages: req.messages },
        {
          signal: controller.signal,
          onDelta: (text) => {
            acc += text
          },
          onDone: () => resolve({ text: acc }),
          onError: (message) => resolve({ text: acc, error: message })
        }
      )
    })
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

  // --- Project context / memory ---------------------------------------------
  ipcMain.handle(IPC.projectContext, (_e, root: string) => buildProjectContext(root))
}
