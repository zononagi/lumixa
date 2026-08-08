import type { Candidate } from './types'

/**
 * CompletionCache — a tiny LRU keyed by `CompletionContext.cacheKey`. Repeated
 * lookups for the same fragment/context (common while the user pauses) skip
 * re-analysis. Entries also carry the document version so a changed document
 * invalidates stale results.
 */

interface Entry {
  version: number
  candidates: Candidate[]
}

const MAX = 200
const map = new Map<string, Entry>()

export function get(key: string, version: number): Candidate[] | undefined {
  const e = map.get(key)
  if (!e || e.version !== version) return undefined
  // Refresh LRU order.
  map.delete(key)
  map.set(key, e)
  return e.candidates
}

export function set(key: string, version: number, candidates: Candidate[]): void {
  map.set(key, { version, candidates })
  if (map.size > MAX) {
    const oldest = map.keys().next().value
    if (oldest !== undefined) map.delete(oldest)
  }
}

export function clear(): void {
  map.clear()
}
