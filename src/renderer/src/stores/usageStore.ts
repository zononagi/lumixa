import { create } from 'zustand'
import type { LumixaActivity, UsageStatus } from '@shared/usage'

/**
 * Renderer usage state: user settings, the latest *official* usage snapshot,
 * a clearly-separate "Lumixa Activity" counter, auto-refresh polling and
 * threshold notifications (with a cooldown).
 *
 * Honesty rules mirrored from the shared contract: notifications/warnings only
 * ever fire off an OFFICIAL percentage. Since Claude Code does not currently
 * expose one, the warning path stays dormant by design rather than guessing.
 */

export type RefreshInterval = 30 | 60 | 300 | 0 // 0 = manual

export interface UsageSettings {
  enabled: boolean
  refreshInterval: RefreshInterval
  showInStatusBar: boolean
  notificationsEnabled: boolean
  warnThreshold: number
  highThreshold: number
  criticalThreshold: number
}

const DEFAULT_SETTINGS: UsageSettings = {
  enabled: true,
  refreshInterval: 60,
  showInStatusBar: true,
  notificationsEnabled: true,
  warnThreshold: 80,
  highThreshold: 90,
  criticalThreshold: 95
}

const NOTIFY_COOLDOWN_MS = 10 * 60_000

function loadSettings(): UsageSettings {
  try {
    const raw = localStorage.getItem('lumixa.usage.settings')
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<UsageSettings>) }
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS
}

interface UsageState {
  settings: UsageSettings
  status: UsageStatus | null
  loading: boolean
  error: string | null
  lastFetchAt: number
  activity: LumixaActivity
  /** Transient in-app warning banner text (null = none). */
  notice: string | null
  lastNotifiedAt: number

  init: () => void
  refresh: () => Promise<void>
  setSetting: <K extends keyof UsageSettings>(key: K, value: UsageSettings[K]) => void
  dismissNotice: () => void

  // Lumixa Activity (non-official) counters.
  bumpSessions: () => void
  bumpMessages: () => void
  bumpToolCalls: () => void
  bumpFilesModified: () => void
  addRuntime: (ms: number) => void
}

let pollTimer: ReturnType<typeof setInterval> | null = null
let subscribed = false

export const useUsageStore = create<UsageState>((set, get) => ({
  settings: loadSettings(),
  status: null,
  loading: false,
  error: null,
  lastFetchAt: 0,
  activity: { sessions: 0, messages: 0, toolCalls: 0, filesModified: 0, runtimeMs: 0 },
  notice: null,
  lastNotifiedAt: 0,

  init: () => {
    if (subscribed) return
    subscribed = true
    if (get().settings.enabled) {
      void get().refresh()
      schedulePolling(get)
    }
  },

  refresh: async () => {
    set({ loading: true, error: null })
    try {
      const status = await window.lumixa.usage.get()
      set({ status, lastFetchAt: Date.now() })
      maybeNotify(get, set, status)
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to read usage' })
    } finally {
      set({ loading: false })
    }
  },

  setSetting: (key, value) => {
    const settings = { ...get().settings, [key]: value }
    localStorage.setItem('lumixa.usage.settings', JSON.stringify(settings))
    set({ settings })
    if (key === 'refreshInterval' || key === 'enabled') schedulePolling(get)
  },

  dismissNotice: () => set({ notice: null }),

  bumpSessions: () => set((s) => ({ activity: { ...s.activity, sessions: s.activity.sessions + 1 } })),
  bumpMessages: () => set((s) => ({ activity: { ...s.activity, messages: s.activity.messages + 1 } })),
  bumpToolCalls: () =>
    set((s) => ({ activity: { ...s.activity, toolCalls: s.activity.toolCalls + 1 } })),
  bumpFilesModified: () =>
    set((s) => ({ activity: { ...s.activity, filesModified: s.activity.filesModified + 1 } })),
  addRuntime: (ms) =>
    set((s) => ({ activity: { ...s.activity, runtimeMs: s.activity.runtimeMs + Math.max(0, ms) } }))
}))

function schedulePolling(get: () => UsageState): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  const { enabled, refreshInterval } = get().settings
  if (!enabled || refreshInterval === 0) return
  pollTimer = setInterval(() => void get().refresh(), refreshInterval * 1000)
}

/** Highest OFFICIAL percentage across windows, or null if none is exposed. */
export function officialMaxPercentage(status: UsageStatus | null): number | null {
  if (!status || !status.official) return null
  const vals = [status.fiveHour?.percentage, status.weekly?.percentage].filter(
    (v): v is number => typeof v === 'number'
  )
  return vals.length ? Math.max(...vals) : null
}

export type NoticeLevel = 'warning' | 'high' | 'critical'

/**
 * Pure notification decision. Returns a notice string when an OFFICIAL usage
 * percentage crosses a threshold and the cooldown has elapsed — otherwise null.
 * Never fires off a figure we don't actually have (percentage === null).
 */
export function computeNotice(
  settings: UsageSettings,
  status: UsageStatus | null,
  lastNotifiedAt: number,
  now: number,
  cooldownMs: number = NOTIFY_COOLDOWN_MS
): { level: NoticeLevel; message: string } | null {
  if (!settings.notificationsEnabled) return null
  const pct = officialMaxPercentage(status)
  if (pct === null) return null
  if (pct < settings.warnThreshold) return null
  if (now - lastNotifiedAt < cooldownMs) return null
  const level: NoticeLevel =
    pct >= settings.criticalThreshold ? 'critical' : pct >= settings.highThreshold ? 'high' : 'warning'
  return { level, message: `Claude Code usage is ${level} (${pct}%).` }
}

function maybeNotify(
  get: () => UsageState,
  set: (partial: Partial<UsageState>) => void,
  status: UsageStatus
): void {
  const { settings, lastNotifiedAt } = get()
  const decision = computeNotice(settings, status, lastNotifiedAt, Date.now())
  if (decision) set({ notice: decision.message, lastNotifiedAt: Date.now() })
}
