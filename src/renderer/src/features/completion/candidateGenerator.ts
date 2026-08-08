import type { editor } from 'monaco-editor'
import type { Candidate, CompletionContext } from './types'
import { lookup } from './projectIndexer'

/**
 * CandidateGenerator — produces raw completion candidates for the current
 * context from two non-AI sources: the project symbol index and a small set of
 * language keywords. Ranking/confidence is applied later by the ranker.
 */

const KEYWORDS: Record<string, string[]> = {
  typescript: ['function', 'const', 'return', 'interface', 'import', 'export', 'async', 'await', 'extends', 'implements', 'readonly'],
  javascript: ['function', 'const', 'return', 'import', 'export', 'async', 'await', 'class', 'extends'],
  python: ['def', 'return', 'import', 'class', 'elif', 'else', 'while', 'lambda', 'yield', 'async', 'await'],
  java: ['public', 'private', 'protected', 'static', 'final', 'return', 'class', 'interface', 'extends', 'implements'],
  csharp: ['public', 'private', 'protected', 'static', 'return', 'class', 'interface', 'namespace', 'using'],
  go: ['func', 'return', 'package', 'import', 'struct', 'interface', 'defer', 'range'],
  rust: ['fn', 'let', 'return', 'struct', 'impl', 'trait', 'match', 'pub', 'async', 'await'],
  cpp: ['return', 'class', 'struct', 'template', 'namespace', 'const', 'public', 'private']
}

// typescript/javascript variants share keyword sets.
function keywordsFor(language: string): string[] {
  if (language === 'typescriptreact') return KEYWORDS.typescript
  if (language === 'javascriptreact') return KEYWORDS.javascript
  return KEYWORDS[language] ?? []
}

export function generate(
  monaco: typeof import('monaco-editor'),
  model: editor.ITextModel,
  ctx: CompletionContext
): Candidate[] {
  const { word } = ctx
  if (word.length < 2) return [] // never suggest from a single char — too noisy

  const out: Candidate[] = []

  for (const sym of lookup(monaco, model, word)) {
    out.push({
      label: sym.label,
      insert: sym.label.slice(word.length),
      source: sym.local ? 'local-scope' : 'project',
      confidence: 0 // filled by the ranker
    })
  }

  for (const kw of keywordsFor(ctx.language)) {
    if (kw !== word && kw.startsWith(word)) {
      out.push({ label: kw, insert: kw.slice(word.length), source: 'keyword', confidence: 0 })
    }
  }

  return out
}
