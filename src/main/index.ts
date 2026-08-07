import { app, BrowserWindow, net, protocol, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerIpcHandlers } from './ipc'
import { killAllTerminals } from './services/terminal'

/**
 * Custom scheme that streams a user-chosen local file (background image/video)
 * to the renderer without loosening the file:// CSP. Must be registered as a
 * privileged, stream-capable scheme before the app is ready.
 */
protocol.registerSchemesAsPrivileged([
  { scheme: 'lumixa-media', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }
])

/** Resolve the app icon if the user has provided one under resources/. */
function appIcon(): string | undefined {
  const candidate = join(__dirname, '../../resources/icon.png')
  return existsSync(candidate) ? candidate : undefined
}

/**
 * Electron main-process entry point. Creates the application window and wires
 * up the IPC boundary. Kept intentionally thin — all real work lives in the
 * services and AI adapters.
 */

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#1e1e1e',
    title: 'Lumixa',
    icon: appIcon(),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  // Open external links in the OS browser, not inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  registerIpcHandlers(win)

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Serve `lumixa-media://local?path=<abs>` from the local filesystem.
  protocol.handle('lumixa-media', (req) => {
    const url = new URL(req.url)
    const filePath = url.searchParams.get('path')
    if (!filePath || !existsSync(filePath)) {
      return new Response('Not found', { status: 404 })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => killAllTerminals())

app.on('window-all-closed', () => {
  killAllTerminals()
  if (process.platform !== 'darwin') app.quit()
})
