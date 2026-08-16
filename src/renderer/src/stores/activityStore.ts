import { create } from 'zustand'
import type { TKey } from '@renderer/i18n'
import type { Activity, ActivitySource, ActivityStatus } from '@renderer/features/activity/activity'

/**
 * The AI Activity Center's event stream (spec §46, §58). Subsystems push entries
 * via logActivity(); the panel renders both the live status and the audit log.
 * In-memory + capped — it's a session activity trail, not persistence.
 */
const MAX = 200
let seq = 0

interface ActivityState {
  entries: Activity[]
  push: (source: ActivitySource, status: ActivityStatus, messageKey: TKey, vars?: Record<string, string | number>) => void
  clear: () => void
}

export const useActivityStore = create<ActivityState>((set) => ({
  entries: [],
  push: (source, status, messageKey, vars) =>
    set((s) => ({
      entries: [{ id: ++seq, ts: Date.now(), source, status, messageKey, vars }, ...s.entries].slice(0, MAX)
    })),
  clear: () => set({ entries: [] })
}))

/** Convenience for non-React callers (other stores). */
export function logActivity(
  source: ActivitySource,
  status: ActivityStatus,
  messageKey: TKey,
  vars?: Record<string, string | number>
): void {
  useActivityStore.getState().push(source, status, messageKey, vars)
}
