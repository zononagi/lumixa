/**
 * Completion engine — public entry point.
 *
 *   Editor
 *     │  (Monaco inline-completions provider)
 *     ▼
 *   CompletionController
 *     ├── contextAnalyzer   — cursor → CompletionContext
 *     ├── projectIndexer    — symbols across the open working set (cached)
 *     ├── candidateGenerator — index symbols + language keywords
 *     ├── candidateRanker   — scope/prefix/usage → confidence
 *     └── completionCache   — LRU keyed by context + document version
 *
 * Non-AI: every candidate comes from the user's own code or language keywords.
 */
export { installCompletionEngine } from './inlineProvider'
