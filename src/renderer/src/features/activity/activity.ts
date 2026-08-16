import type { TKey } from '@renderer/i18n'

/**
 * Unified AI Activity Center model (spec §46-§47, §58). A single timestamped
 * stream of what Lumixa's subsystems + Claude Code are doing, so the user always
 * has one place to see current activity and an audit trail. Messages are stored
 * as an i18n key + vars so the log stays translatable.
 */
export type ActivitySource = 'claude' | 'brain' | 'heal' | 'bug' | 'tests' | 'watcher'
export type ActivityStatus = 'running' | 'done' | 'error' | 'info'

export interface Activity {
  id: number
  ts: number
  source: ActivitySource
  status: ActivityStatus
  messageKey: TKey
  vars?: Record<string, string | number>
}

export const ACTIVITY_SOURCES: ActivitySource[] = ['claude', 'brain', 'heal', 'bug', 'tests', 'watcher']

/** Latest entry per source (input is newest-first) — the "live status" view. */
export function currentBySource(entries: Activity[]): Activity[] {
  const seen = new Set<ActivitySource>()
  const out: Activity[] = []
  for (const e of entries) {
    if (seen.has(e.source)) continue
    seen.add(e.source)
    out.push(e)
  }
  return out
}

export const isActive = (a: Activity): boolean => a.status === 'running'

/** Compact relative time like "just now", "3m ago", "2h ago". */
export function relTime(ts: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 5) return 'now'
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.round(h / 24)}d`
}
