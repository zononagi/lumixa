import type { editor, Position } from 'monaco-editor'
import type { CompletionContext } from './types'

/**
 * ContextAnalyzer — turns a (model, position) into a `CompletionContext`:
 * the current identifier fragment, the line prefix, and a cache key. Kept cheap
 * so it can run on every keystroke without blocking input.
 */

const IDENT_TAIL = /[A-Za-z_$][A-Za-z0-9_$]*$/

export function analyze(model: editor.ITextModel, position: Position): CompletionContext {
  const offset = model.getOffsetAt(position)
  const text = model.getValue()
  const linePrefix = model.getValueInRange({
    startLineNumber: position.lineNumber,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column
  })
  const word = IDENT_TAIL.exec(linePrefix)?.[0] ?? ''
  const language = model.getLanguageId()
  // Cache key: language + the identifier + a short trailing window of context so
  // the same fragment in the same syntactic spot reuses results.
  const window = linePrefix.slice(-24)
  return {
    language,
    text,
    offset,
    linePrefix,
    word,
    cacheKey: `${language}::${window}`
  }
}
