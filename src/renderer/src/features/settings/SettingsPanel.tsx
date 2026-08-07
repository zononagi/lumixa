import { useEffect, useState, type CSSProperties, type JSX } from 'react'
import type { AuthAccount, ProviderId, WindowEffect } from '@shared/ipc'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import {
  useAppearanceStore,
  parseVSCodeTheme,
  type BackgroundType
} from '@renderer/stores/appearanceStore'
import { useAgentsStore } from '@renderer/stores/agentsStore'
import { usePermissionsStore, type Capability, type Policy } from '@renderer/stores/permissionsStore'
import { useT, useI18nStore, LOCALES, type TKey } from '@renderer/i18n'

interface ProviderMeta {
  id: ProviderId
  name: string
  signInLabel: TKey
}

const PROVIDERS: ProviderMeta[] = [
  { id: 'anthropic', name: 'Anthropic (Claude)', signInLabel: 'settings.signInClaude' },
  { id: 'openai', name: 'OpenAI (ChatGPT)', signInLabel: 'settings.signInChatGPT' }
]

/**
 * Settings view: account linking (OAuth) + model refresh. Users sign in with
 * their Claude / ChatGPT account — no API keys. Tokens are stored encrypted in
 * the main process and never reach the renderer.
 */
export function SettingsPanel(): JSX.Element {
  const { accounts, refreshAuth, refreshModels, models, loadingModels } = useSettingsStore()
  const t = useT()
  const { locale, setLocale } = useI18nStore()

  useEffect(() => {
    void refreshAuth()
  }, [refreshAuth])

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>{t('settings.title')}</span>
      </div>
      <div className="settings">
        <div className="provider-row">
          <label>{t('settings.language')}</label>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as (typeof LOCALES)[number]['id'])}
            style={{
              width: '100%',
              background: '#3c3c3c',
              color: 'var(--fg)',
              border: '1px solid #3c3c3c',
              borderRadius: 4,
              padding: '6px 8px'
            }}
          >
            {LOCALES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <h2>{t('settings.accounts')}</h2>
        <p className="hint">{t('settings.accountsHint')}</p>

        {PROVIDERS.map((p) => (
          <AccountRow
            key={p.id}
            meta={p}
            account={accounts.find((a) => a.provider === p.id)}
          />
        ))}

        <AgentsSettings />
        <PermissionsSettings />
        <AppearanceSettings />

        <div style={{ marginTop: 8 }}>
          <button className="provider-row" onClick={() => void refreshModels()}>
            <span
              style={{
                background: 'var(--accent)',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: 4,
                display: 'inline-block'
              }}
            >
              {loadingModels ? t('settings.refreshing') : t('settings.refresh')}
            </span>
          </button>
          <p className="hint" style={{ marginTop: 10 }}>
            {models.length > 0
              ? t('settings.modelsAvailable', { n: models.length })
              : t('settings.noModels')}
          </p>
        </div>
      </div>
    </div>
  )
}

function AccountRow({
  meta,
  account
}: {
  meta: ProviderMeta
  account?: AuthAccount
}): JSX.Element {
  const { login, submitCode, logout } = useSettingsStore()
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [needsCode, setNeedsCode] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const connected = account?.connected ?? false

  const onSignIn = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const result = await login(meta.id)
      if (!result.ok) setError(result.error ?? 'Sign-in failed.')
      else if (result.needsCode) setNeedsCode(true)
    } finally {
      setBusy(false)
    }
  }

  const onSubmitCode = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await submitCode(meta.id, code.trim())
      setNeedsCode(false)
      setCode('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="provider-row">
      <label>
        {meta.name}
        {connected && (
          <span className="ok">
            {' '}
            {t('settings.connected')}
            {account?.label ? ` — ${account.label}` : ''}
          </span>
        )}
      </label>

      {connected ? (
        <div className="field">
          <button onClick={() => void logout(meta.id)}>{t('settings.signOut')}</button>
        </div>
      ) : needsCode ? (
        <div className="field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <p className="hint">{t('settings.pasteCodeHint')}</p>
          <div className="field">
            <input
              type="text"
              placeholder={t('settings.pasteCodePlaceholder')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button disabled={busy || !code.trim()} onClick={() => void onSubmitCode()}>
              {busy ? t('settings.connecting') : t('action.save')}
            </button>
          </div>
        </div>
      ) : (
        <div className="field">
          <button disabled={busy} onClick={() => void onSignIn()}>
            {busy ? t('settings.connecting') : t(meta.signInLabel)}
          </button>
        </div>
      )}

      {error && (
        <p className="hint" style={{ color: 'var(--danger, #e06c75)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

/** Agents: manage named profiles, each with a custom System Prompt + model. */
function AgentsSettings(): JSX.Element {
  const { agents, activeId, setActive, add, update, remove } = useAgentsStore()
  const models = useSettingsStore((s) => s.models)
  const t = useT()

  const inputStyle: CSSProperties = {
    width: '100%',
    background: '#3c3c3c',
    color: 'var(--fg)',
    border: '1px solid #3c3c3c',
    borderRadius: 4,
    padding: '6px 8px',
    marginBottom: 6
  }

  return (
    <>
      <h2 style={{ marginTop: 20 }}>{t('settings.agents')}</h2>
      <p className="hint">{t('settings.agentsHint')}</p>

      {agents.map((a) => (
        <div key={a.id} className="provider-row" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <label>
            🤖 {a.name}
            {a.id === activeId ? (
              <span className="ok">{t('settings.agentActive')}</span>
            ) : (
              <button style={{ marginLeft: 8, padding: '2px 8px' }} onClick={() => setActive(a.id)}>
                {t('settings.agentSetActive')}
              </button>
            )}
          </label>
          <input
            style={inputStyle}
            value={a.name}
            placeholder={t('settings.agentName')}
            onChange={(e) => update(a.id, { name: e.target.value })}
          />
          <select
            style={inputStyle}
            value={a.model ?? ''}
            onChange={(e) => update(a.id, { model: e.target.value || null })}
          >
            <option value="">{t('settings.agentModelDefault')}</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
          <textarea
            style={{ ...inputStyle, minHeight: 70, fontFamily: 'var(--font-mono)', resize: 'vertical' }}
            value={a.systemPrompt}
            placeholder={t('settings.agentSystem')}
            onChange={(e) => update(a.id, { systemPrompt: e.target.value })}
          />
          {agents.length > 1 && (
            <button className="danger" style={{ padding: '2px 8px' }} onClick={() => remove(a.id)}>
              {t('settings.agentDelete')}
            </button>
          )}
        </div>
      ))}
      <button className="provider-row" style={{ marginTop: 8 }} onClick={() => add()}>
        <span style={{ background: 'var(--accent)', color: '#fff', padding: '6px 12px', borderRadius: 4, display: 'inline-block' }}>
          {t('settings.agentAdd')}
        </span>
      </button>
    </>
  )
}

/** Permission management: coarse allow/ask/deny policies per capability. */
function PermissionsSettings(): JSX.Element {
  const { policies, set } = usePermissionsStore()
  const t = useT()

  const rows: { cap: Capability; label: TKey }[] = [
    { cap: 'fileWrite', label: 'settings.permFileWrite' },
    { cap: 'runCommand', label: 'settings.permRunCommand' },
    { cap: 'network', label: 'settings.permNetwork' }
  ]
  const options: { value: Policy; label: TKey }[] = [
    { value: 'allow', label: 'settings.permAllow' },
    { value: 'ask', label: 'settings.permAsk' },
    { value: 'deny', label: 'settings.permDeny' }
  ]

  return (
    <>
      <h2 style={{ marginTop: 20 }}>{t('settings.permissions')}</h2>
      <p className="hint">{t('settings.permissionsHint')}</p>
      {rows.map(({ cap, label }) => (
        <div key={cap} className="provider-row">
          <label>{t(label)}</label>
          <select
            value={policies[cap]}
            onChange={(e) => set(cap, e.target.value as Policy)}
            style={{
              width: '100%',
              background: '#3c3c3c',
              color: 'var(--fg)',
              border: '1px solid #3c3c3c',
              borderRadius: 4,
              padding: '6px 8px'
            }}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.label)}
              </option>
            ))}
          </select>
        </div>
      ))}
    </>
  )
}

/** Appearance: window effect (Mica/Acrylic), theme, translucency, background. */
function AppearanceSettings(): JSX.Element {
  const {
    effect,
    opacity,
    background,
    dim,
    mode,
    custom,
    setEffect,
    setOpacity,
    setBackground,
    setDim,
    setMode,
    setCustomTheme
  } = useAppearanceStore()
  const t = useT()
  const [themeError, setThemeError] = useState<string | null>(null)

  const importTheme = async (): Promise<void> => {
    setThemeError(null)
    const picked = await window.lumixa.fs.pickFile(
      [{ name: 'VS Code Theme', extensions: ['json'] }],
      true
    )
    if (!picked?.content) return
    try {
      setCustomTheme(parseVSCodeTheme(picked.content, picked.path.split(/[\\/]/).pop() ?? 'Custom'))
    } catch (e) {
      setThemeError(e instanceof Error ? e.message : String(e))
    }
  }

  const pickBackground = async (type: Exclude<BackgroundType, 'none'>): Promise<void> => {
    const filters =
      type === 'image'
        ? [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
        : [{ name: 'Video', extensions: ['mp4', 'webm', 'mkv', 'mov'] }]
    const picked = await window.lumixa.fs.pickFile(filters, false)
    if (picked) setBackground({ type, url: picked.mediaUrl })
  }

  const selStyle = {
    width: '100%',
    background: '#3c3c3c',
    color: 'var(--fg)',
    border: '1px solid #3c3c3c',
    borderRadius: 4,
    padding: '6px 8px'
  }

  return (
    <>
      <h2 style={{ marginTop: 20 }}>{t('settings.appearance')}</h2>
      <p className="hint">{t('settings.appearanceHint')}</p>

      <div className="provider-row">
        <label>{t('settings.windowEffect')}</label>
        <select
          value={effect}
          onChange={(e) => setEffect(e.target.value as WindowEffect)}
          style={selStyle}
        >
          <option value="none">{t('settings.effectNone')}</option>
          <option value="mica">{t('settings.effectMica')}</option>
          <option value="acrylic">{t('settings.effectAcrylic')}</option>
        </select>
        <p className="hint" style={{ marginTop: 4 }}>
          {t('settings.winOnly')}
        </p>
      </div>

      <div className="provider-row">
        <label>{t('settings.theme')}</label>
        <div className="field">
          <button
            style={{ background: mode === 'dark' ? 'var(--accent)' : '#3c3c3c' }}
            onClick={() => setMode('dark')}
          >
            {t('settings.themeDark')}
          </button>
          <button
            style={{ background: mode === 'light' ? 'var(--accent)' : '#3c3c3c' }}
            onClick={() => setMode('light')}
          >
            {t('settings.themeLight')}
          </button>
          <button onClick={() => void importTheme()}>{t('settings.importTheme')}</button>
        </div>
        {mode === 'custom' && custom && (
          <p className="hint" style={{ marginTop: 4 }}>
            {t('settings.themeImported', { name: custom.name })}
          </p>
        )}
        {themeError && (
          <p className="hint" style={{ color: 'var(--danger)' }}>
            {themeError}
          </p>
        )}
      </div>

      <div className="provider-row">
        <label>
          {t('settings.uiOpacity')} — {Math.round(opacity * 100)}%
        </label>
        <input
          type="range"
          min={0.3}
          max={1}
          step={0.05}
          value={opacity}
          style={{ width: '100%' }}
          onChange={(e) => setOpacity(parseFloat(e.target.value))}
        />
      </div>

      <div className="provider-row">
        <label>{t('settings.background')}</label>
        <div className="field">
          <button
            style={{ background: background.type === 'none' ? 'var(--accent)' : '#3c3c3c' }}
            onClick={() => setBackground({ type: 'none', url: '' })}
          >
            {t('settings.bgNone')}
          </button>
          <button onClick={() => void pickBackground('image')}>{t('settings.bgImage')}</button>
          <button onClick={() => void pickBackground('video')}>{t('settings.bgVideo')}</button>
        </div>
        {background.type !== 'none' && (
          <div style={{ marginTop: 8 }}>
            <label>
              {t('settings.bgDim')} — {Math.round(dim * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={0.85}
              step={0.05}
              value={dim}
              style={{ width: '100%' }}
              onChange={(e) => setDim(parseFloat(e.target.value))}
            />
          </div>
        )}
      </div>
    </>
  )
}
