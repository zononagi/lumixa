import { shell } from 'electron'
import { createHash, randomBytes } from 'node:crypto'
import http from 'node:http'
import type { ProviderId, LoginResult } from '@shared/ipc'
import { getTokens, setTokens, type TokenBundle } from './tokenStore'

/**
 * OAuth 2.0 + PKCE account linking for the AI providers.
 *
 * This replicates the public "sign in with your subscription" flows used by the
 * official CLIs (Claude Code for Anthropic, Codex for OpenAI/ChatGPT), so a
 * Lumixa user signs in with their existing Claude / ChatGPT account instead of
 * pasting an API key. Two redirect strategies are supported:
 *
 *   • loopback — a throwaway http server on a fixed localhost port catches the
 *     redirect and reads the `code` automatically (OpenAI).
 *   • paste    — the provider only allows a hosted redirect that displays the
 *     authorization code; the user copies it back into the app (Anthropic).
 *
 * NOTE: client IDs and endpoints below mirror the official CLIs. They are the
 * moving parts most likely to change over time — if login starts failing,
 * update the matching `ProviderConfig`.
 */

type RedirectMode =
  | { type: 'loopback'; port: number; path: string }
  | { type: 'paste'; uri: string }

interface ProviderConfig {
  authorizeUrl: string
  tokenUrl: string
  clientId: string
  scopes: string
  redirect: RedirectMode
  /** How the token endpoint expects the exchange body encoded. */
  tokenBody: 'json' | 'form'
  /** Extra params appended to the authorize URL. */
  extraAuthParams?: Record<string, string>
}

const CONFIGS: Record<ProviderId, ProviderConfig> = {
  anthropic: {
    authorizeUrl: 'https://claude.ai/oauth/authorize',
    tokenUrl: 'https://console.anthropic.com/v1/oauth/token',
    clientId: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
    scopes: 'org:create_api_key user:profile user:inference',
    redirect: { type: 'paste', uri: 'https://console.anthropic.com/oauth/code/callback' },
    tokenBody: 'json',
    extraAuthParams: { code: 'true' }
  },
  openai: {
    authorizeUrl: 'https://auth.openai.com/oauth/authorize',
    tokenUrl: 'https://auth.openai.com/oauth/token',
    clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
    scopes: 'openid profile email offline_access',
    redirect: { type: 'loopback', port: 1455, path: '/auth/callback' },
    tokenBody: 'form',
    extraAuthParams: { id_token_add_organizations: 'true', prompt: 'login' }
  }
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

const base64url = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function pkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

/** Best-effort decode of a JWT payload (no signature verification needed here). */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Pending flows (kept in memory between authorize and code exchange)
// ---------------------------------------------------------------------------

interface PendingFlow {
  verifier: string
  state: string
  redirectUri: string
}
const pending = new Map<ProviderId, PendingFlow>()

function authorizeUrl(cfg: ProviderConfig, verifier: string, state: string, redirectUri: string): string {
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    scope: cfg.scopes,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    ...(cfg.extraAuthParams ?? {})
  })
  return `${cfg.authorizeUrl}?${params.toString()}`
}

// ---------------------------------------------------------------------------
// Token exchange / refresh
// ---------------------------------------------------------------------------

function bundleFromResponse(json: Record<string, unknown>): TokenBundle {
  const accessToken = String(json.access_token ?? '')
  const refreshToken = json.refresh_token ? String(json.refresh_token) : undefined
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : undefined
  const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined

  const bundle: TokenBundle = { accessToken, refreshToken, expiresAt }

  // Derive a friendly label + provider extras from an id_token when present.
  if (typeof json.id_token === 'string') {
    const claims = decodeJwt(json.id_token)
    if (claims) {
      const email = typeof claims.email === 'string' ? claims.email : undefined
      const auth = claims['https://api.openai.com/auth'] as Record<string, unknown> | undefined
      const accountId = auth && typeof auth.chatgpt_account_id === 'string' ? auth.chatgpt_account_id : undefined
      if (email) bundle.label = email
      if (accountId) bundle.meta = { chatgptAccountId: accountId }
    }
  }
  return bundle
}

async function exchange(cfg: ProviderConfig, body: Record<string, string>): Promise<TokenBundle> {
  const init: RequestInit =
    cfg.tokenBody === 'json'
      ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
      : {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(body).toString()
        }
  const res = await fetch(cfg.tokenUrl, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Token endpoint returned ${res.status}: ${text.slice(0, 300)}`)
  }
  const json = (await res.json()) as Record<string, unknown>
  const bundle = bundleFromResponse(json)
  if (!bundle.accessToken) throw new Error('Token endpoint did not return an access_token.')
  return bundle
}

async function completeExchange(provider: ProviderId, code: string): Promise<void> {
  const cfg = CONFIGS[provider]
  const flow = pending.get(provider)
  if (!flow) throw new Error('No pending login for this provider. Start again.')

  const bundle = await exchange(cfg, {
    grant_type: 'authorization_code',
    code,
    state: flow.state,
    client_id: cfg.clientId,
    redirect_uri: flow.redirectUri,
    code_verifier: flow.verifier
  })
  if (!bundle.label) bundle.label = provider === 'anthropic' ? 'Claude account' : 'ChatGPT account'
  await setTokens(provider, bundle)
  pending.delete(provider)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Kick off the OAuth flow. For loopback providers this resolves only once the
 * browser round-trip finishes (or times out). For paste providers it resolves
 * immediately with `needsCode: true`; the caller then collects the code and
 * calls `submitCode`.
 */
export async function startLogin(provider: ProviderId): Promise<LoginResult> {
  const cfg = CONFIGS[provider]
  const { verifier } = pkce()
  const state = base64url(randomBytes(16))

  if (cfg.redirect.type === 'paste') {
    const redirectUri = cfg.redirect.uri
    pending.set(provider, { verifier, state, redirectUri })
    await shell.openExternal(authorizeUrl(cfg, verifier, state, redirectUri))
    return { ok: true, needsCode: true }
  }

  // Loopback: catch the redirect automatically.
  const { port, path } = cfg.redirect
  const redirectUri = `http://localhost:${port}${path}`
  pending.set(provider, { verifier, state, redirectUri })

  return new Promise<LoginResult>((resolve) => {
    let settled = false
    const finish = (result: LoginResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      server.close()
      resolve(result)
    }

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`)
      if (url.pathname !== path) {
        res.writeHead(404).end()
        return
      }
      const code = url.searchParams.get('code')
      const returnedState = url.searchParams.get('state')
      const err = url.searchParams.get('error')

      const reply = (msg: string): void => {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(
          `<!doctype html><meta charset="utf-8"><title>Lumixa</title>` +
            `<body style="font-family:system-ui;background:#1e1e1e;color:#eee;display:grid;place-items:center;height:100vh;margin:0">` +
            `<div style="text-align:center"><h2>${msg}</h2><p>You can close this window and return to Lumixa.</p></div>`
        )
      }

      if (err) {
        reply('Sign-in failed.')
        finish({ ok: false, error: err })
        return
      }
      if (!code || returnedState !== state) {
        reply('Sign-in failed.')
        finish({ ok: false, error: 'Invalid OAuth callback (state mismatch or missing code).' })
        return
      }
      reply('Signed in ✓')
      completeExchange(provider, code)
        .then(() => finish({ ok: true }))
        .catch((e: unknown) =>
          finish({ ok: false, error: e instanceof Error ? e.message : String(e) })
        )
    })

    server.on('error', (e) =>
      finish({ ok: false, error: `Could not start local callback server on port ${port}: ${e.message}` })
    )

    const timer = setTimeout(() => finish({ ok: false, error: 'Login timed out.' }), 5 * 60 * 1000)

    server.listen(port, '127.0.0.1', () => {
      void shell.openExternal(authorizeUrl(cfg, verifier, state, redirectUri))
    })
  })
}

/** Paste-flow completion: the user hands back the authorization code. */
export async function submitCode(provider: ProviderId, rawCode: string): Promise<LoginResult> {
  try {
    // Anthropic's hosted callback shows the code as `CODE#STATE`; tolerate both.
    const code = rawCode.trim().split('#')[0]
    await completeExchange(provider, code)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Return a valid access token for a connected provider, transparently
 * refreshing it when expired. Returns null when the provider isn't linked or
 * the refresh fails (caller should treat as "not signed in").
 */
export async function getValidAccessToken(provider: ProviderId): Promise<string | null> {
  const bundle = await getTokens(provider)
  if (!bundle) return null

  const stillValid = !bundle.expiresAt || bundle.expiresAt - Date.now() > 60_000
  if (stillValid) return bundle.accessToken
  if (!bundle.refreshToken) return bundle.accessToken // no way to refresh; try as-is

  try {
    const cfg = CONFIGS[provider]
    const refreshed = await exchange(cfg, {
      grant_type: 'refresh_token',
      refresh_token: bundle.refreshToken,
      client_id: cfg.clientId
    })
    // Refresh responses may omit a new refresh token / label — keep the old ones.
    const merged: TokenBundle = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? bundle.refreshToken,
      expiresAt: refreshed.expiresAt,
      label: refreshed.label ?? bundle.label,
      meta: refreshed.meta ?? bundle.meta
    }
    await setTokens(provider, merged)
    return merged.accessToken
  } catch {
    // Refresh failed — fall back to the (possibly stale) token; the provider
    // call will surface a clear auth error if it's truly dead.
    return bundle.accessToken
  }
}

/** Provider-specific extras needed at request time (e.g. ChatGPT account id). */
export async function getAccountMeta(provider: ProviderId): Promise<Record<string, string> | undefined> {
  return (await getTokens(provider))?.meta
}
