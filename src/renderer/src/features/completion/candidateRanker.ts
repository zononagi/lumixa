import type { Candidate, CompletionContext } from './types'

/**
 * CandidateRanker — assigns a confidence score to each candidate and returns
 * them best-first. Priority mirrors the spec:
 *   local scope > project > keyword, longer prefix match, higher usage.
 *
 * Confidence is deliberately conservative: we would rather show nothing than a
 * wrong Ghost Text, so scores stay below the display threshold unless the match
 * is strong and reasonably unambiguous.
 */

const SOURCE_WEIGHT: Record<Candidate['source'], number> = {
  'local-scope': 0.6,
  project: 0.45,
  keyword: 0.35
}

export function rank(candidates: Candidate[], ctx: CompletionContext): Candidate[] {
  const total = candidates.length
  const scored = candidates.map((c) => {
    let score = SOURCE_WEIGHT[c.source]
    // Longer already-typed prefixes are far less ambiguous.
    score += Math.min(ctx.word.length, 6) * 0.06
    // A short remaining insert (we've nearly typed the whole word) is safer.
    if (c.insert.length <= 4) score += 0.1
    // Ambiguity penalty: many equally-plausible candidates → lower confidence.
    if (total > 3) score -= 0.1
    return { ...c, confidence: Math.max(0, Math.min(1, score)) }
  })

  return scored.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return a.insert.length - b.insert.length
  })
}
