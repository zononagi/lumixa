import { describe, it, expect } from 'vitest'
import { mapLimit } from './concurrency'

const tick = (ms = 0): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe('mapLimit', () => {
  it('preserves input order regardless of completion order', async () => {
    const items = [30, 5, 20, 1, 10]
    const out = await mapLimit(items, 2, async (n) => {
      await tick(n)
      return n * 2
    })
    expect(out).toEqual([60, 10, 40, 2, 20])
  })

  it('never exceeds the concurrency limit', async () => {
    let active = 0
    let peak = 0
    await mapLimit(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
      active++
      peak = Math.max(peak, active)
      await tick(3)
      active--
    })
    expect(peak).toBeLessThanOrEqual(4)
    expect(peak).toBeGreaterThan(1)
  })

  it('handles an empty list', async () => {
    expect(await mapLimit([], 4, async (x) => x)).toEqual([])
  })

  it('runs all items when limit exceeds length', async () => {
    const out = await mapLimit([1, 2, 3], 10, async (n) => n + 1)
    expect(out).toEqual([2, 3, 4])
  })
})
