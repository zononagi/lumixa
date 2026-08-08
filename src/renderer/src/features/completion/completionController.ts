import type { editor, Position, CancellationToken } from 'monaco-editor'
import { analyze } from './contextAnalyzer'
import { generate } from './candidateGenerator'
import { rank } from './candidateRanker'
import * as cache from './completionCache'
import type { Candidate } from './types'

/**
 * CompletionController — orchestrates the pipeline used by the Ghost Text
 * provider:
 *
 *   analyze → cache lookup → generate → rank → confidence filter
 *
 * It is pure/synchronous and cheap (all data is in memory), and honours the
 * Monaco CancellationToken so a superseded keystroke's work is dropped before it
 * can reach the UI (Monaco cancels the previous token on each new request, which
 * gives us request-ordering for free).
 */

// Below this, we show nothing rather than risk a wrong suggestion.
const CONFIDENCE_THRESHOLD = 0.62

export interface InlineResult {
  insert: string
  label: string
}

export function compute(
  monaco: typeof import('monaco-editor'),
  model: editor.ITextModel,
  position: Position,
  token: CancellationToken
): InlineResult | null {
  const ctx = analyze(model, position)
  if (ctx.word.length < 2) return null

  const version = model.getVersionId()
  let candidates: Candidate[] | undefined = cache.get(ctx.cacheKey, version)
  if (!candidates) {
    if (token.isCancellationRequested) return null
    candidates = rank(generate(monaco, model, ctx), ctx)
    cache.set(ctx.cacheKey, version, candidates)
  }

  if (token.isCancellationRequested) return null

  const best = candidates[0]
  if (!best || !best.insert || best.confidence < CONFIDENCE_THRESHOLD) return null
  return { insert: best.insert, label: best.label }
}
