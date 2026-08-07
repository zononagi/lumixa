import { dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import type { DirEntry, OpenFolderResult } from '@shared/ipc'

/**
 * Filesystem service. All disk access lives in the main process; the renderer
 * reaches it only through the typed IPC bridge. Paths are treated as opaque
 * absolute strings supplied by the user's own workspace.
 */

const IGNORED = new Set(['.git', 'node_modules', '.DS_Store', 'out', 'dist'])

export async function openFolderDialog(): Promise<OpenFolderResult | null> {
  const win = BrowserWindow.getFocusedWindow() ?? undefined
  const result = win
    ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    : await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled || result.filePaths.length === 0) return null
  const root = result.filePaths[0]
  return { root, name: basename(root) }
}

export async function readDir(dirPath: string): Promise<DirEntry[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  return entries
    .filter((e) => !IGNORED.has(e.name))
    .map((e) => ({
      name: e.name,
      path: join(dirPath, e.name),
      isDirectory: e.isDirectory()
    }))
    .sort((a, b) => {
      // Directories first, then alphabetical.
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8')
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8')
}
