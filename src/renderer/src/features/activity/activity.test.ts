import { describe, it, expect } from 'vitest'
import { currentBySource, isActive, relTime, type Activity } from './activity'

const a = (id: number, source: Activity['source'], status: Activity['status']): Activity => ({
  id,
  ts: id * 1000,
  source,
  status,
  messageKey: 'act.title'
})

describe('currentBySource', () => {
  it('keeps only the newest entry per source (input newest-first)', () => {
    const entries = [
      a(5, 'claude', 'done'),
      a(4, 'brain', 'done'),
      a(3, 'claude', 'running'), // older claude — dropped
      a(2, 'tests', 'error')
    ]
    const cur = currentBySource(entries)
    expect(cur.map((e) => e.source)).toEqual(['claude', 'brain', 'tests'])
    expect(cur.find((e) => e.source === 'claude')?.status).toBe('done')
  })
})

describe('isActive', () => {
  it('is true only for running entries', () => {
    expect(isActive(a(1, 'heal', 'running'))).toBe(true)
    expect(isActive(a(1, 'heal', 'done'))).toBe(false)
  })
})

describe('relTime', () => {
  const now = 1_000_000_000
  it('formats seconds/minutes/hours/days', () => {
    expect(relTime(now, now)).toBe('now')
    expect(relTime(now - 30_000, now)).toBe('30s')
    expect(relTime(now - 5 * 60_000, now)).toBe('5m')
    expect(relTime(now - 3 * 3_600_000, now)).toBe('3h')
    expect(relTime(now - 2 * 86_400_000, now)).toBe('2d')
  })
})
