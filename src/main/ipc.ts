import { ipcMain, type BrowserWindow } from 'electron'
import {
  IPC,
  type AuthAccount,
  type ChatStartRequest,
  type CompleteRequest,
  type CompleteResult,
  type ModelInfo,
  type ProviderId,
  type TerminalCreateRequest
} from '@shared/ipc'
import { openFolderDialog, readDir, readFile, writeFile, pickFile } from './services/fs'
import { getTokens, clearTokens, listConnectedProviders } from './services/tokenStore'
import { startLogin, submitCode, getValidAccessToken, getAccountMeta } from './services/oauth'
import { getProvider, registeredProviderIds } from './ai/registry'
import type { Credential } from './ai/types'
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

  // --- Account linking (OAuth) ----------------------------------------------
  ipcMain.handle(IPC.authStatus, async (): Promise<AuthAccount[]> => {
    const connected = await listConnectedProviders()
    const out: AuthAccount[] = []
    for (const id of registeredProviderIds()) {
      const tokens = connected.includes(id) ? await getTokens(id) : null
      out.push({ provider: id, connected: tokens !== null, label: tokens?.label })
    }
    return out
  })
  ipcMain.handle(IPC.authLogin, (_e, provider: ProviderId) => startLogin(provider))
  ipcMain.handle(IPC.authSubmitCode, (_e, provider: ProviderId, code: string) =>
    submitCode(provider, code)
  )
  ipcMain.handle(IPC.authLogout, async (_e, provider: ProviderId) => {
    await clearTokens(provider)
    return { ok: true }
  })

  // Resolve a valid credential (refreshing the token if needed) for a provider.
  const credentialFor = async (provider: ProviderId): Promise<Credential | null> => {
    const token = await getValidAccessToken(provider)
    if (!token) return null
    return { token, meta: await getAccountMeta(provider) }
  }

  // --- AI: model discovery --------------------------------------------------
  ipcMain.handle(IPC.aiListModels, async (): Promise<ModelInfo[]> => {
    const connected = await listConnectedProviders()
    const out: ModelInfo[] = []
    for (const id of registeredProviderIds()) {
      if (!connected.includes(id)) continue // hide unlinked providers
      const provider = getProvider(id)
      const cred = await credentialFor(id)
      if (!provider || !cred) continue
      out.push(...(await provider.listModels(cred)))
    }
    return out
  })

  // --- AI: streaming chat ---------------------------------------------------
  const active = new Map<string, AbortController>()

  ipcMain.handle(IPC.aiChatStart, async (_e, req: ChatStartRequest) => {
    const provider = getProvider(req.provider)
    const cred = await credentialFor(req.provider)
    const send = (channel: string, payload: unknown): void => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload)
    }

    if (!provider || !cred) {
      send(IPC.aiChatError, {
        requestId: req.requestId,
        message: `Provider "${req.provider}" is not linked. Sign in from Settings.`
      })
      return
    }

    const controller = new AbortController()
    active.set(req.requestId, controller)

    await provider.streamChat(
      cred,
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
    const cred = await credentialFor(req.provider)
    if (!provider || !cred) {
      return { text: '', error: `Provider "${req.provider}" is not linked. Sign in from Settings.` }
    }
    return new Promise<CompleteResult>((resolve) => {
      let acc = ''
      const controller = new AbortController()
      void provider.streamChat(
        cred,
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
  ipcMain.handle(IPC.gitMerge, (_e, cwd: string, branch: string) => git.merge(cwd, branch))
  ipcMain.handle(IPC.gitMergeAbort, (_e, cwd: string) => git.mergeAbort(cwd))
  ipcMain.handle(IPC.gitRebase, (_e, cwd: string, branch: string) => git.rebase(cwd, branch))
  ipcMain.handle(IPC.gitRebaseContinue, (_e, cwd: string) => git.rebaseContinue(cwd))
  ipcMain.handle(IPC.gitRebaseAbort, (_e, cwd: string) => git.rebaseAbort(cwd))

  // --- Project context / memory ---------------------------------------------
  ipcMain.handle(IPC.projectContext, (_e, root: string) => buildProjectContext(root))
}
