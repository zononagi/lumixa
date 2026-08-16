import type { WatcherCategory, WatcherFinding, Confidence } from '@shared/brain'

/**
 * AI Code Watcher rules (spec §13). Deliberately conservative, high-precision
 * static heuristics — no AI, no network — so the Watcher can run on every index
 * pass without burning CPU or API budget (§48), and without drowning the user in
 * false positives (§14). Each rule carries a confidence; the UI hides low-
 * confidence findings by default.
 *
 * Findings are produced without an absolute `path`; the caller (Project Brain,
 * which already has the file open) fills that in.
 */

export type RawFinding = Omit<WatcherFinding, 'path'>

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/

interface LineRule {
  id: string
  category: WatcherCategory
  confidence: Confidence
  severity: 'warn' | 'info'
  message: string
  /** Must be a fresh regex per test (no global state); matched per line. */
  test: (line: string) => boolean
}

// Strip line/block-comment-ish content cheaply to cut false positives.
const isCommentLine = (line: string): boolean => /^\s*(\/\/|\*|\/\*)/.test(line)

const LINE_RULES: LineRule[] = [
  {
    id: 'debugger',
    category: 'suspicious',
    confidence: 'high',
    severity: 'warn',
    message: 'Leftover `debugger` statement — remove before shipping.',
    test: (l) => /(^|\s|;)debugger\s*;?\s*$/.test(l)
  },
  {
    id: 'hardcoded-secret',
    category: 'security',
    confidence: 'high',
    severity: 'warn',
    message: 'Looks like a hard-coded secret/credential — move it to an env var.',
    test: (l) =>
      /(api[_-]?key|secret|password|passwd|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"][^'"]{8,}['"]/i.test(
        l
      )
  },
  {
    id: 'loose-equality',
    category: 'suspicious',
    confidence: 'medium',
    severity: 'warn',
    message: 'Uses `==`/`!=` — prefer strict `===`/`!==` to avoid coercion bugs.',
    test: (l) => /[^=!<>]==[^=]/.test(l) || /!=[^=]/.test(l)
  },
  {
    id: 'any-type',
    category: 'types',
    confidence: 'low',
    severity: 'info',
    message: 'Uses `any` — consider a precise type for better safety.',
    test: (l) => /:\s*any(\b|\[|>|,|\)|;|$)/.test(l)
  },
  {
    id: 'console-log',
    category: 'dead-code',
    confidence: 'low',
    severity: 'info',
    message: 'Leftover `console.log` — likely debug output.',
    test: (l) => /console\.(log|debug)\s*\(/.test(l)
  },
  {
    id: 'todo',
    category: 'dead-code',
    confidence: 'low',
    severity: 'info',
    message: 'Unresolved TODO/FIXME.',
    test: (l) => /\b(TODO|FIXME|XXX)\b/.test(l)
  }
]

/** Empty catch block, e.g. `catch (e) {}` or `catch {}` — missing error handling. */
const EMPTY_CATCH = /catch\s*(\([^)]*\))?\s*\{\s*\}/

/** Network calls without any timeout/abort handling in the file. */
const USES_FETCH = /\b(fetch|axios|XMLHttpRequest)\b/
const HAS_TIMEOUT = /\b(timeout|AbortController|AbortSignal|signal)\b/

export function scanContent(rel: string, text: string): RawFinding[] {
  if (!CODE_EXT.test(rel) || !text) return []
  const findings: RawFinding[] = []
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isCommentLine(line)) continue
    for (const rule of LINE_RULES) {
      if (rule.test(line)) {
        findings.push({
          id: `${rel}:${rule.id}:${i + 1}`,
          rel,
          line: i + 1,
          ruleId: rule.id,
          category: rule.category,
          message: rule.message,
          confidence: rule.confidence,
          severity: rule.severity
        })
      }
    }
  }

  // File-level rules ---------------------------------------------------------
  const emptyCatch = text.search(EMPTY_CATCH)
  if (emptyCatch >= 0) {
    const line = text.slice(0, emptyCatch).split('\n').length
    findings.push({
      id: `${rel}:empty-catch:${line}`,
      rel,
      line,
      ruleId: 'empty-catch',
      category: 'error-handling',
      message: 'Empty catch block swallows errors — handle or log the error.',
      confidence: 'high',
      severity: 'warn'
    })
  }

  if (USES_FETCH.test(text) && !HAS_TIMEOUT.test(text)) {
    const idx = text.search(USES_FETCH)
    const line = text.slice(0, Math.max(0, idx)).split('\n').length
    findings.push({
      id: `${rel}:no-timeout:${line}`,
      rel,
      line,
      ruleId: 'no-timeout',
      category: 'error-handling',
      message: 'Network requests here have no timeout/abort handling.',
      confidence: 'medium',
      severity: 'warn'
    })
  }

  return findings
}
