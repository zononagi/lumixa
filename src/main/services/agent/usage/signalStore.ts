/**
 * Collects the ONLY official usage signal Claude Code currently exposes: the
 * `rate_limit_event` line emitted on `--output-format stream-json`. It carries
 * a real server reset timestamp + coarse status, but no percentage. We keep the
 * latest signal per window so the usage provider can surface reset timers.
 *
 * This is fed raw NDJSON lines observed from actual agent runs — no polling of
 * private endpoints, no token reading.
 */

export type UsageWindowKey = 'fiveHour' | 'weekly'

export interface UsageSignal {
  /** Server reset timestamp, ms epoch. */
  resetAt?: number
  /** Coarse status, e.g. 'allowed' | 'rejected'. */
  status?: string
  overageStatus?: string
  /** When Lumixa observed this signal (local ms). */
  observedAt: number
}

const signals = new Map<UsageWindowKey, UsageSignal>()

/** Map the provider's rateLimitType string onto a Lumixa window bucket. */
function classify(rateLimitType: unknown): UsageWindowKey | null {
  if (typeof rateLimitType !== 'string') return null
  const t = rateLimitType.toLowerCase()
  if (t.includes('week') || t.includes('seven')) return 'weekly'
  if (t.includes('five') || t.includes('hour')) return 'fiveHour'
  return null
}

/** Parse one raw NDJSON line; record any rate-limit signal it contains. */
export function ingestUsageLine(line: string): void {
  const trimmed = line.trim()
  if (trimmed[0] !== '{') return
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(trimmed)
  } catch {
    return
  }
  if (obj.type !== 'rate_limit_event') return
  const info = obj.rate_limit_info as Record<string, unknown> | undefined
  if (!info) return
  const bucket = classify(info.rateLimitType)
  if (!bucket) return
  signals.set(bucket, {
    resetAt: typeof info.resetsAt === 'number' ? info.resetsAt * 1000 : undefined,
    status: typeof info.status === 'string' ? info.status : undefined,
    overageStatus: typeof info.overageStatus === 'string' ? info.overageStatus : undefined,
    observedAt: Date.now()
  })
}

export function getSignal(key: UsageWindowKey): UsageSignal | undefined {
  return signals.get(key)
}

/** Test/reset helper. */
export function clearSignals(): void {
  signals.clear()
}
