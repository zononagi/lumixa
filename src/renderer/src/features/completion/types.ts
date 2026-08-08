/**
 * Completion engine — shared types.
 *
 * The engine is intentionally decoupled from the editor UI: the Monaco
 * inline-completions provider ([inlineProvider.ts]) is the only bridge. All the
 * analysis/generation/ranking logic below is plain, testable functions.
 *
 * This engine is NOT AI. Candidates come from the open documents' symbols, the
 * project index, and language keywords — never a network/LLM call.
 */

/** Everything the analyzers extract about the cursor position. */
export interface CompletionContext {
  language: string
  /** Full document text. */
  text: string
  /** 0-based character offset of the cursor. */
  offset: number
  /** Text of the current line up to the cursor. */
  linePrefix: string
  /** The identifier fragment immediately left of the cursor (may be ''). */
  word: string
  /** A stable key for caching (language + word + small context window). */
  cacheKey: string
}

/** Where a candidate came from — drives ranking weight. */
export type CandidateSource =
  | 'local-scope' // identifier used in the current document
  | 'project' // identifier from another open document / project index
  | 'keyword' // language keyword / built-in

export interface Candidate {
  /** The full symbol/word being suggested. */
  label: string
  /** The text to insert after the already-typed `word` (the ghost text). */
  insert: string
  source: CandidateSource
  /** 0..1 — only high-confidence candidates become Ghost Text. */
  confidence: number
}
