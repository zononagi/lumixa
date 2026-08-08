import type * as Monaco from 'monaco-editor'
import { compute } from './completionController'

/**
 * CompletionRenderer/Provider bridge — registers a Monaco inline-completions
 * provider that surfaces the engine's suggestion as Ghost Text. Monaco handles
 * the UX natively: Tab accepts, Escape dismisses, and continued typing triggers
 * a fresh request (cancelling the previous one).
 *
 * This complements — does not replace — Monaco's built-in IntelliSense
 * (member/type/import completion, quick fixes, go-to-definition).
 */

// Languages the Ghost Text engine is enabled for. Built-in IntelliSense still
// applies to all languages regardless.
const LANGUAGES = [
  'typescript',
  'javascript',
  'typescriptreact',
  'javascriptreact',
  'python',
  'java',
  'csharp',
  'cpp',
  'c',
  'go',
  'rust',
  'json',
  'css',
  'scss',
  'less',
  'html'
]

let registered = false

export function installCompletionEngine(monaco: typeof Monaco): void {
  if (registered) return
  registered = true

  const provider: Monaco.languages.InlineCompletionsProvider = {
    provideInlineCompletions(model, position, _ctx, token) {
      const result = compute(monaco, model, position, token)
      if (!result) return { items: [] }
      return {
        items: [
          {
            insertText: result.insert,
            // Empty range at the cursor → pure Ghost Text insertion.
            range: new monaco.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column
            )
          }
        ]
      }
    },
    freeInlineCompletions() {
      // Nothing to dispose — results are plain objects.
    }
  }

  for (const language of LANGUAGES) {
    monaco.languages.registerInlineCompletionsProvider(language, provider)
  }
}
