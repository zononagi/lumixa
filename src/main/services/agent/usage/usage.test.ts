import { describe, it, expect, beforeEach } from 'vitest'
import { ingestUsageLine, clearSignals, getSignal } from './signalStore'
import { ClaudeCodeUsageProvider } from './claudeCodeUsage'

function rateLimitLine(rateLimitType: string, resetsAtSec: number, status = 'allowed'): string {
  return JSON.stringify({
    type: 'rate_limit_event',
    rate_limit_info: { status, resetsAt: resetsAtSec, rateLimitType, overageStatus: 'rejected' }
  })
}

describe('usage signalStore', () => {
  beforeEach(() => clearSignals())

  it('captures a five_hour reset timestamp (converted to ms)', () => {
    ingestUsageLine(rateLimitLine('five_hour', 1786602000))
    expect(getSignal('fiveHour')?.resetAt).toBe(1786602000 * 1000)
    expect(getSignal('weekly')).toBeUndefined()
  })

  it('classifies weekly-style rate limit types', () => {
    ingestUsageLine(rateLimitLine('seven_day', 1786600000))
    expect(getSignal('weekly')?.resetAt).toBe(1786600000 * 1000)
  })

  it('ignores non-rate-limit and malformed lines', () => {
    ingestUsageLine('not json')
    ingestUsageLine(JSON.stringify({ type: 'assistant', message: { content: [] } }))
    ingestUsageLine('{ broken')
    expect(getSignal('fiveHour')).toBeUndefined()
    expect(getSignal('weekly')).toBeUndefined()
  })
})

describe('ClaudeCodeUsageProvider.getUsage', () => {
  beforeEach(() => clearSignals())

  it('reports unavailable when nothing has been observed', async () => {
    const usage = await new ClaudeCodeUsageProvider().getUsage()
    expect(usage.status).toBe('unavailable')
    expect(usage.fiveHour).toBeUndefined()
    expect(usage.weekly).toBeUndefined()
    expect(usage.official).toBe(true)
  })

  it('reports partial with a reset time but NEVER a percentage (5h only)', async () => {
    ingestUsageLine(rateLimitLine('five_hour', 1786602000))
    const usage = await new ClaudeCodeUsageProvider().getUsage()
    expect(usage.status).toBe('partial')
    expect(usage.fiveHour?.resetAt).toBe(1786602000 * 1000)
    expect(usage.fiveHour?.percentage).toBeUndefined()
    expect(usage.weekly).toBeUndefined()
  })

  it('reports weekly-only when only a weekly signal exists', async () => {
    ingestUsageLine(rateLimitLine('weekly', 1786600000))
    const usage = await new ClaudeCodeUsageProvider().getUsage()
    expect(usage.status).toBe('partial')
    expect(usage.weekly?.resetAt).toBe(1786600000 * 1000)
    expect(usage.fiveHour).toBeUndefined()
  })

  it('reports both windows when both signals exist', async () => {
    ingestUsageLine(rateLimitLine('five_hour', 1786602000))
    ingestUsageLine(rateLimitLine('weekly', 1786600000))
    const usage = await new ClaudeCodeUsageProvider().getUsage()
    expect(usage.status).toBe('partial')
    expect(usage.fiveHour?.resetAt).toBeDefined()
    expect(usage.weekly?.resetAt).toBeDefined()
  })

  it('tracks lastUpdated after a read', async () => {
    const provider = new ClaudeCodeUsageProvider()
    expect(provider.getLastUpdated()).toBe(0)
    await provider.getUsage()
    expect(provider.getLastUpdated()).toBeGreaterThan(0)
  })
})
