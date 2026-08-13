import { describe, it, expect } from 'vitest'
import type { UsageStatus } from '@shared/usage'
import { officialMaxPercentage, computeNotice, type UsageSettings } from './usageStore'
import { formatDuration } from '@renderer/lib/format'

const settings: UsageSettings = {
  enabled: true,
  refreshInterval: 60,
  showInStatusBar: true,
  notificationsEnabled: true,
  warnThreshold: 80,
  highThreshold: 90,
  criticalThreshold: 95
}

const base = (partial: Partial<UsageStatus>): UsageStatus => ({
  provider: 'claude-code',
  status: 'partial',
  updatedAt: 0,
  official: true,
  ...partial
})

describe('officialMaxPercentage', () => {
  it('returns null when no official percentage exists (never guesses)', () => {
    expect(officialMaxPercentage(null)).toBeNull()
    expect(officialMaxPercentage(base({ fiveHour: { resetAt: 1 } }))).toBeNull()
  })

  it('ignores figures that are not marked official', () => {
    const s = base({ official: false, fiveHour: { percentage: 99 } })
    expect(officialMaxPercentage(s)).toBeNull()
  })

  it('returns the highest official percentage', () => {
    const s = base({ fiveHour: { percentage: 72 }, weekly: { percentage: 48 } })
    expect(officialMaxPercentage(s)).toBe(72)
  })
})

describe('computeNotice', () => {
  it('does not notify without an official percentage (no fake usage)', () => {
    expect(computeNotice(settings, base({ fiveHour: { resetAt: 1 } }), 0, 1000)).toBeNull()
  })

  it('does not notify below the warning threshold', () => {
    expect(computeNotice(settings, base({ fiveHour: { percentage: 50 } }), 0, 1000)).toBeNull()
  })

  it('notifies at warning / high / critical levels', () => {
    expect(computeNotice(settings, base({ fiveHour: { percentage: 82 } }), 0, 1e9)?.level).toBe('warning')
    expect(computeNotice(settings, base({ fiveHour: { percentage: 91 } }), 0, 1e9)?.level).toBe('high')
    expect(computeNotice(settings, base({ fiveHour: { percentage: 96 } }), 0, 1e9)?.level).toBe(
      'critical'
    )
  })

  it('respects the cooldown', () => {
    const status = base({ fiveHour: { percentage: 96 } })
    // lastNotifiedAt very recent -> suppressed
    expect(computeNotice(settings, status, 1_000_000, 1_000_100, 60_000)).toBeNull()
    // cooldown elapsed -> fires
    expect(computeNotice(settings, status, 1_000_000, 1_100_000, 60_000)).not.toBeNull()
  })

  it('does not notify when notifications are disabled', () => {
    const s = { ...settings, notificationsEnabled: false }
    expect(computeNotice(s, base({ fiveHour: { percentage: 99 } }), 0, 1e9)).toBeNull()
  })
})

describe('formatDuration', () => {
  it('formats days/hours/minutes/seconds compactly', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(-5)).toBe('0s')
    expect(formatDuration(45 * 1000)).toBe('45s')
    expect(formatDuration((2 * 60 + 14) * 1000)).toBe('2m 14s')
    expect(formatDuration((2 * 3600 + 14 * 60) * 1000)).toBe('2h 14m')
    expect(formatDuration((3 * 86400 + 8 * 3600) * 1000)).toBe('3d 8h')
  })
})
