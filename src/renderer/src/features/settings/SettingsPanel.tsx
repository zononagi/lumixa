import { useEffect, useState, type JSX } from 'react'
import type { ProviderId } from '@shared/ipc'
import { useSettingsStore } from '@renderer/stores/settingsStore'

interface ProviderMeta {
  id: ProviderId
  name: string
  placeholder: string
  available: boolean
}

// Phase 1 wires Anthropic end-to-end; the rest are scaffolded for later phases.
const PROVIDERS: ProviderMeta[] = [
  { id: 'anthropic', name: 'Anthropic (Claude)', placeholder: 'sk-ant-…', available: true },
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-…', available: false },
  { id: 'gemini', name: 'Google Gemini', placeholder: 'AIza…', available: false },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-…', available: false },
  { id: 'ollama', name: 'Ollama (local)', placeholder: 'http://localhost:11434', available: false }
]

/** Settings view: API key management + model refresh. Keys are stored encrypted. */
export function SettingsPanel(): JSX.Element {
  const { configured, refreshConfigured, saveKey, refreshModels, models, loadingModels } =
    useSettingsStore()

  useEffect(() => {
    void refreshConfigured()
  }, [refreshConfigured])

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>Settings</span>
      </div>
      <div className="settings">
        <h2>Providers</h2>
        <p className="hint">
          Bring your own API key. Keys are encrypted with your OS keychain (DPAPI /
          Keychain) and never leave this machine. Providers without a key are hidden
          from the model picker.
        </p>

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
              {loadingModels ? 'Refreshing…' : '↻ Refresh models'}
            </span>
          </button>
          <p className="hint" style={{ marginTop: 10 }}>
            {models.length > 0
              ? `${models.length} model(s) available.`
              : 'No models yet — add a key above, then refresh.'}
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

  return (
    <div className="provider-row">
      <label>
        {meta.name}
        {!meta.available && (
          <span style={{ color: 'var(--fg-muted)', fontWeight: 400 }}> — coming soon</span>
        )}
        {configured && <span className="ok">✓ configured</span>}
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
          Save
        </button>
      </div>
    </div>
  )
}
