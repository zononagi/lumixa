import type { UsageStatus, UsageWindow } from '@shared/usage'
import { getSignal } from './signalStore'
import type { UsageProvider } from './types'

/**
 * Usage provider backed exclusively by official Claude Code `stream-json`
 * `rate_limit_event` output harvested from real runs.
 *
 * What it can honestly surface today:
 *  - `resetAt` (real server timestamp) for the five-hour and/or weekly windows,
 *    once such an event has been observed.
 *  - a coarse `status` (allowed / rejected).
 * What it deliberately does NOT surface (because the CLI does not expose it):
 *  - `percentage`, `used`, `limit`. These stay undefined — never estimated.
 *
 * Result: `partial` when a reset timer is known, otherwise `unavailable`.
 */
export class ClaudeCodeUsageProvider implements UsageProvider {
  readonly id = 'claude-code'
  private lastUpdated = 0

  async isSupported(): Promise<boolean> {
    // The provider always exists; it reports availability via getUsage().
    return true
  }

  getLastUpdated(): number {
    return this.lastUpdated
  }

  async getUsage(): Promise<UsageStatus> {
    const fiveHour = toWindow('fiveHour')
    const weekly = toWindow('weekly')
    this.lastUpdated = Date.now()

    const haveAny = Boolean(fiveHour || weekly)
    return {
      provider: 'claude-code',
      fiveHour,
      weekly,
      status: haveAny ? 'partial' : 'unavailable',
      updatedAt: this.lastUpdated,
      official: true,
      note: haveAny
        ? 'Claude Code exposes reset times but not exact usage percentages.'
        : 'Claude Code has not reported any rate-limit info yet. Run an agent request to populate reset times. Usage percentages are not exposed.'
    }
  }
}

function toWindow(key: 'fiveHour' | 'weekly'): UsageWindow | undefined {
  const sig = getSignal(key)
  if (!sig || sig.resetAt === undefined) return undefined
  return {
    resetAt: sig.resetAt,
    status: sig.status
    // percentage/used/limit intentionally omitted — not exposed by the CLI.
  }
}
