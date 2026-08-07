import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { ProviderId } from '@shared/ipc'

/**
 * Secure per-provider OAuth token storage.
 *
 * The whole token bundle (access token, refresh token, expiry, account label)
 * is serialized to JSON and encrypted with Electron's `safeStorage`
 * (Windows DPAPI / macOS Keychain) before being persisted as base64 in a JSON
 * file under the app's userData directory. Plaintext tokens never leave the main
 * process — the renderer only ever learns *whether* a provider is connected and
 * an optional display label, never the token values.
 */

export interface TokenBundle {
  accessToken: string
  refreshToken?: string
  /** Epoch milliseconds at which `accessToken` expires (if known). */
  expiresAt?: number
  /** Friendly label for the linked account (email / plan / account id). */
  label?: string
  /** Provider-specific extras (e.g. ChatGPT account id) kept opaque here. */
  meta?: Record<string, string>
}

interface StoreFile {
  // provider -> base64(encrypted JSON(TokenBundle))
  [provider: string]: string
}

const storePath = (): string => join(app.getPath('userData'), 'accounts.json')

async function readAll(): Promise<StoreFile> {
  try {
    const raw = await fs.readFile(storePath(), 'utf-8')
    return JSON.parse(raw) as StoreFile
  } catch {
    return {}
  }
}

async function writeAll(data: StoreFile): Promise<void> {
  await fs.writeFile(storePath(), JSON.stringify(data, null, 2), 'utf-8')
}

function encode(json: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(json).toString('base64')
  }
  // Fallback: OS-level encryption unavailable (rare). Store obfuscated so it is
  // at least not plaintext-greppable; still local-only.
  return Buffer.from(json, 'utf-8').toString('base64')
}

function decode(stored: string): string | null {
  const buf = Buffer.from(stored, 'base64')
  try {
    if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buf)
    return buf.toString('utf-8')
  } catch {
    return null
  }
}

export async function setTokens(provider: ProviderId, bundle: TokenBundle): Promise<void> {
  const data = await readAll()
  data[provider] = encode(JSON.stringify(bundle))
  await writeAll(data)
}

export async function getTokens(provider: ProviderId): Promise<TokenBundle | null> {
  const data = await readAll()
  const stored = data[provider]
  if (!stored) return null
  const json = decode(stored)
  if (!json) return null
  try {
    return JSON.parse(json) as TokenBundle
  } catch {
    return null
  }
}

export async function clearTokens(provider: ProviderId): Promise<void> {
  const data = await readAll()
  delete data[provider]
  await writeAll(data)
}

/** Returns the set of providers that currently have a token bundle stored. */
export async function listConnectedProviders(): Promise<ProviderId[]> {
  const data = await readAll()
  return Object.keys(data) as ProviderId[]
}
