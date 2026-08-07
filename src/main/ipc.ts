import { ipcMain, type BrowserWindow } from 'electron'
import {
  IPC,
  type ChatStartRequest,
  type ModelInfo,
  type ProviderId
} from '@shared/ipc'
import { openFolderDialog, readDir, readFile, writeFile } from './services/fs'
import { getSecret, setSecret, listConfiguredProviders } from './services/secrets'
import { getProvider, registeredProviderIds } from './ai/registry'

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
}
