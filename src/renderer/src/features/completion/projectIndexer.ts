import type { editor } from 'monaco-editor'

/**
 * ProjectIndexer — a lightweight symbol index built from every open Monaco
 * model (the working set). For each identifier it tracks how often it appears
 * and whether it is defined in the "current" document, which the ranker uses to
 * prefer in-scope symbols.
 *
 * Incremental + cached: each model's identifiers are memoised against its
 * version id, so re-indexing only happens for models that actually changed.
 */

const IDENT = /[A-Za-z_$][A-Za-z0-9_$]{1,}/g
// Tokens too generic to ever suggest as ghost text.
const STOPWORDS = new Set(['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while'])

interface ModelIndex {
  version: number
  counts: Map<string, number>
}

const cache = new WeakMap<editor.ITextModel, ModelIndex>()

function indexModel(model: editor.ITextModel): Map<string, number> {
  const cached = cache.get(model)
  const version = model.getVersionId()
  if (cached && cached.version === version) return cached.counts

  const counts = new Map<string, number>()
  const text = model.getValue()
  let m: RegExpExecArray | null
  IDENT.lastIndex = 0
  while ((m = IDENT.exec(text)) !== null) {
    const w = m[0]
    if (STOPWORDS.has(w)) continue
    counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  cache.set(model, { version, counts })
  return counts
}

export interface IndexedSymbol {
  label: string
  count: number
  local: boolean
}

/**
 * Return symbols across the working set that start with `prefix` (excluding an
 * exact match). `current` is the active model — its symbols are flagged `local`.
 */
export function lookup(
  monaco: typeof import('monaco-editor'),
  current: editor.ITextModel,
  prefix: string,
  limit = 20
): IndexedSymbol[] {
  if (prefix.length < 2) return []
  const localCounts = indexModel(current)
  const merged = new Map<string, IndexedSymbol>()

  const add = (counts: Map<string, number>, local: boolean): void => {
    for (const [label, count] of counts) {
      if (label === prefix || !label.startsWith(prefix)) continue
      const existing = merged.get(label)
      if (existing) {
        existing.count += count
        existing.local = existing.local || local
      } else {
        merged.set(label, { label, count, local })
      }
    }
  }

  add(localCounts, true)
  for (const model of monaco.editor.getModels()) {
    if (model === current) continue
    add(indexModel(model), false)
  }

  return [...merged.values()].sort((a, b) => b.count - a.count).slice(0, limit)
}
