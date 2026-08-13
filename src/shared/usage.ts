/**
 * Usage-monitor contract.
 *
 * IMPORTANT / honesty guarantees:
 *  - Lumixa NEVER fabricates a usage percentage. A `percentage`/`used`/`limit`
 *    is only ever set when it comes from official Claude Code output.
 *  - The only official signal currently exposed is the `rate_limit_event` line
 *    in `--output-format stream-json`, which provides a real server `resetAt`
 *    timestamp + a coarse status, but NOT a percentage. So the realistic best
 *    case today is `status: 'partial'` (reset timer known, percentage unknown).
 *  - Reset timers use the server timestamp only; we never infer a reset time
 *    from the local clock alone.
 *  - "Lumixa Activity" below is explicitly NOT Claude usage — a separate local
 *    metric, always labelled as such.
 */

export type UsageOverallStatus = 'available' | 'partial' | 'unavailable' | 'unknown'

export interface UsageWindow {
  /** Only set from official data. */
  used?: number
  limit?: number
  percentage?: number
  /** Server-provided reset timestamp (ms epoch). */
  resetAt?: number
  /** Coarse server status, e.g. 'allowed' | 'rejected'. */
  status?: string
}

export interface UsageStatus {
  provider: 'claude-code'
  fiveHour?: UsageWindow
  weekly?: UsageWindow
  /** Overall availability of *official* usage data. */
  status: UsageOverallStatus
  updatedAt: number
  /** True only when every populated figure came from official Claude Code output. */
  official: boolean
  /** Short, honest note about what could/couldn't be obtained. */
  note?: string
  /** True when Claude Code isn't signed in (UI shows an auth prompt). */
  authRequired?: boolean
}

/** Local, non-official activity counters. NEVER presented as Claude usage. */
export interface LumixaActivity {
  sessions: number
  messages: number
  toolCalls: number
  filesModified: number
  /** Total agent working time in ms (summed from run durations). */
  runtimeMs: number
}
