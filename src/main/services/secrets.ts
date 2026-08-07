import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { ProviderId } from '@shared/ipc'

/**
 * Secure per-provider secret storage.
 *
 * API keys are encrypted with Electron's `safeStorage` (Windows DPAPI / macOS
 * Keychain) and persisted as base64 in a JSON file under the app's userData
 * directory. Plaintext keys never leave the main process — the renderer only
 * ever learns *whether* a provider has a key configured, never the value.
 */

interface SecretsFile {
  // provider -> base64(encrypted key)
  [provider: string]: string
}

const secretsPath = (): string => join(app.getPath('userData'), 'secrets.json')

async function readAll(): Promise<SecretsFile> {
  try {
    const raw = await fs.readFile(secretsPath(), 'utf-8')
    return JSON.parse(raw) as SecretsFile
  } catch {
    return {}
  }
}

async function writeAll(data: SecretsFile): Promise<void> {
  await fs.writeFile(secretsPath(), JSON.stringify(data, null, 2), 'utf-8')
}

export async function setSecret(provider: ProviderId, key: string): Promise<void> {
  const data = await readAll()
  if (!key) {
    delete data[provider]
  } else if (safeStorage.isEncryptionAvailable()) {
    data[provider] = safeStorage.encryptString(key).toString('base64')
  } else {
    // Fallback: OS-level encryption unavailable (rare). Store obfuscated so it
    // is at least not plaintext-greppable; still local-only.
    data[provider] = Buffer.from(key, 'utf-8').toString('base64')
  }
  await writeAll(data)
}

export async function getSecret(provider: ProviderId): Promise<string | null> {
  const data = await readAll()
  const stored = data[provider]
  if (!stored) return null
  const buf = Buffer.from(stored, 'base64')
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(buf)
    }
    return buf.toString('utf-8')
  } catch {
    return null
  }
}

/** Returns the set of providers that currently have a key configured. */
export async function listConfiguredProviders(): Promise<ProviderId[]> {
  const data = await readAll()
  return Object.keys(data) as ProviderId[]
}
