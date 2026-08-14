import { useState, type JSX } from 'react'
import type { WindowEffect } from '@shared/ipc'
import {
  useAppearanceStore,
  parseVSCodeTheme,
  type BackgroundType
} from '@renderer/stores/appearanceStore'
import { useUsageStore, type RefreshInterval } from '@renderer/stores/usageStore'
import { useExperienceStore, type ExperienceMode } from '@renderer/stores/experienceStore'
import { useT, useI18nStore, LOCALES } from '@renderer/i18n'

/** Settings view: language + appearance (window effect, theme, background). */
export function SettingsPanel(): JSX.Element {
  const t = useT()
  const { locale, setLocale } = useI18nStore()

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

        <ExperienceSettings />
        <AppearanceSettings />
        <ClaudeCodeSettings />
      </div>
    </div>
  )
}

/** Experience level: Beginner / Developer / Expert (spec §3–§5). */
function ExperienceSettings(): JSX.Element {
  const t = useT()
  const mode = useExperienceStore((s) => s.mode)
  const setMode = useExperienceStore((s) => s.setMode)
  const modes: ExperienceMode[] = ['beginner', 'developer', 'expert']
  return (
    <>
      <h2 style={{ marginTop: 20 }}>{t('settings.experience')}</h2>
      <p className="hint">{t('settings.experienceHint')}</p>
      <div className="provider-row">
        <div className="field">
          {modes.map((m) => (
            <button
              key={m}
              style={{ background: mode === m ? 'var(--accent)' : '#3c3c3c' }}
              onClick={() => setMode(m)}
            >
              {t(`mode.${m}`)}
            </button>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 4 }}>
          {t(`mode.${mode}.desc`)}
        </p>
      </div>
    </>
  )
}

/** Claude Code usage-monitor settings. */
function ClaudeCodeSettings(): JSX.Element {
  const t = useT()
  const { settings, setSetting } = useUsageStore()
  const selStyle = {
    width: '100%',
    background: '#3c3c3c',
    color: 'var(--fg)',
    border: '1px solid #3c3c3c',
    borderRadius: 4,
    padding: '6px 8px'
  }

  const toggle = (
    key: 'enabled' | 'showInStatusBar' | 'notificationsEnabled',
    label: string
  ): JSX.Element => (
    <label className="settings-check">
      <input
        type="checkbox"
        checked={settings[key]}
        onChange={(e) => setSetting(key, e.target.checked)}
      />
      {label}
    </label>
  )

  const threshold = (
    key: 'warnThreshold' | 'highThreshold' | 'criticalThreshold',
    label: string
  ): JSX.Element => (
    <div className="provider-row">
      <label>
        {label} — {settings[key]}%
      </label>
      <input
        type="range"
        min={50}
        max={100}
        step={1}
        value={settings[key]}
        style={{ width: '100%' }}
        onChange={(e) => setSetting(key, parseInt(e.target.value, 10))}
      />
    </div>
  )

  return (
    <>
      <h2 style={{ marginTop: 20 }}>{t('settings.claudeCode')}</h2>

      <div className="provider-row">{toggle('enabled', t('settings.usageMonitor'))}</div>

      <div className="provider-row">
        <label>{t('settings.autoRefresh')}</label>
        <select
          value={settings.refreshInterval}
          onChange={(e) => setSetting('refreshInterval', Number(e.target.value) as RefreshInterval)}
          style={selStyle}
        >
          <option value={30}>{t('settings.refresh30')}</option>
          <option value={60}>{t('settings.refresh60')}</option>
          <option value={300}>{t('settings.refresh300')}</option>
          <option value={0}>{t('settings.refreshManual')}</option>
        </select>
      </div>

      <div className="provider-row">{toggle('showInStatusBar', t('settings.showUsageStatusBar'))}</div>
      <div className="provider-row">
        {toggle('notificationsEnabled', t('settings.usageNotifications'))}
      </div>

      {threshold('warnThreshold', t('settings.warnThreshold'))}
      {threshold('highThreshold', t('settings.highThreshold'))}
      {threshold('criticalThreshold', t('settings.criticalThreshold'))}
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
