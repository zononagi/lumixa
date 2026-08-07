import { useEffect, useState, type JSX } from 'react'
import type { ProviderId } from '@shared/ipc'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useT, useI18nStore, LOCALES } from '@renderer/i18n'

interface ProviderMeta {
  id: ProviderId
  name: string
  placeholder: string
  available: boolean
}

const PROVIDERS: ProviderMeta[] = [
  { id: 'anthropic', name: 'Anthropic (Claude)', placeholder: 'sk-ant-… or account token', available: true },
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-… or account token', available: true },
  { id: 'gemini', name: 'Google Gemini', placeholder: 'AIza…', available: false },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-…', available: false },
  { id: 'ollama', name: 'Ollama (local)', placeholder: 'http://localhost:11434', available: false }
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
        {!meta.available && (
          <span style={{ color: 'var(--fg-muted)', fontWeight: 400 }}>
            {' — '}
            {t('settings.comingSoon')}
          </span>
        )}
        {configured && <span className="ok">{t('settings.configured')}</span>}
      </label>
      <div className="field">
        <input
          type="password"
          placeholder={meta.placeholder}
          value={value}
          disabled={!meta.available}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          disabled={!meta.available || !value.trim()}
          onClick={() => {
            onSave(value.trim())
            setValue('')
          }}
        >
          {t('action.save')}
        </button>
      </div>
    </div>
  )
}
