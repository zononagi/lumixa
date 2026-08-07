import { useEffect, useState, type CSSProperties, type JSX } from 'react'
import type { ProviderId, WindowEffect } from '@shared/ipc'
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
  placeholder: string
  /** Where to get a key — shown as a hint under the field. */
  keysUrl: string
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    placeholder: 'sk-ant-…',
    keysUrl: 'console.anthropic.com → API Keys'
  },
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-…', keysUrl: 'platform.openai.com → API keys' }
]

/** Settings view: API key management + model refresh. Keys are stored encrypted. */
export function SettingsPanel(): JSX.Element {
  const { configured, refreshConfigured, saveKey, refreshModels, models, loadingModels } =
    useSettingsStore()
  const t = useT()
  const { locale, setLocale } = useI18nStore()

  useEffect(() => {
    void refreshConfigured()
  }, [refreshConfigured])

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

        <h2>{t('settings.providers')}</h2>
        <p className="hint">{t('settings.providersHint')}</p>

        {PROVIDERS.map((p) => (
          <ProviderRow
            key={p.id}
            meta={p}
            configured={configured.includes(p.id)}
            onSave={(key) => void saveKey(p.id, key)}
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

function ProviderRow({
  meta,
  configured,
  onSave
}: {
  meta: ProviderMeta
  configured: boolean
  onSave: (key: string) => void
}): JSX.Element {
  const [value, setValue] = useState('')
  const t = useT()

  return (
    <div className="provider-row">
      <label>
        {meta.name}
        {configured && <span className="ok">{t('settings.configured')}</span>}
      </label>
      <div className="field">
        <input
          type="password"
          placeholder={meta.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          disabled={!value.trim()}
          onClick={() => {
            onSave(value.trim())
            setValue('')
          }}
        >
          {t('action.save')}
        </button>
      </div>
      <p className="hint" style={{ marginTop: 4 }}>
        {t('settings.getKey', { where: meta.keysUrl })}
      </p>
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
