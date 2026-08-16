import type { ProjectSummary } from '@shared/brain'

/**
 * Bug Detective (spec §15-§17). Lumixa gathers *deterministic* evidence (git
 * history, working diff, Problems, related files from the Project Brain) and
 * hands it to Claude Code with a structured investigation prompt. The
 * hypotheses / confidence come from Claude — clearly AI analysis — never
 * fabricated by Lumixa. The pure helpers below (keyword extraction, related-file
 * matching, prompt building) are unit-tested.
 */

export interface ProblemLite {
  path: string
  line: number
  message: string
  severity: number
}

export interface BugEvidence {
  keywords: string[]
  recentCommits: string[]
  hasUncommitted: boolean
  diffSnippet: string
  problems: ProblemLite[]
  summary: ProjectSummary | null
  relatedFiles: string[]
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'when', 'from', 'have', 'has', 'not', 'but',
  'すると', 'たまに', 'なる', 'なります', 'する', 'して', 'いる', 'ある', 'こと', 'ため', 'よう',
  'page', 'error', 'errors', 'bug', 'issue', 'problem', 'app', 'screen'
])

/** Extract candidate identifiers/terms from a free-text bug description. */
export function extractKeywords(description: string): string[] {
  const out = new Set<string>()
  // ASCII words (identifiers, camelCase, file names) + CJK runs.
  const tokens = description.match(/[A-Za-z][A-Za-z0-9_]{2,}|[぀-ヿ一-鿿]{2,}/g) ?? []
  for (const raw of tokens) {
    const t = raw.toLowerCase()
    if (STOPWORDS.has(t)) continue
    out.add(raw)
    if (out.size >= 12) break
  }
  return [...out]
}

/** Files whose path contains any keyword (case-insensitive). */
export function relatedFiles(
  files: { rel: string }[],
  keywords: string[],
  limit = 10
): string[] {
  if (keywords.length === 0) return []
  const kw = keywords.map((k) => k.toLowerCase())
  const hits: string[] = []
  for (const f of files) {
    const lower = f.rel.toLowerCase()
    if (kw.some((k) => lower.includes(k))) {
      hits.push(f.rel)
      if (hits.length >= limit) break
    }
  }
  return hits
}

function summaryLine(s: ProjectSummary | null): string {
  if (!s) return '(unknown stack)'
  return [s.framework, s.language, s.build, s.state, s.testing, s.runtime]
    .filter(Boolean)
    .join(' · ')
}

/** Build the structured investigation prompt handed to Claude Code. */
export function buildInvestigationPrompt(description: string, e: BugEvidence): string {
  const parts: string[] = []
  parts.push(
    'You are a Bug Detective investigating a problem in this project. Investigate the actual code ' +
      '(read the relevant files, and run the test suite if it helps). Then answer STRICTLY in this format:\n' +
      '\n## Hypotheses (most likely first)\n' +
      'For each: a one-line cause, a confidence percentage, and the concrete evidence supporting it.\n' +
      '\n## Reproduction\n' +
      'State whether you could reproduce it (e.g. via tests) and how; if not, say "Unable to reproduce" and what evidence is missing.\n' +
      '\n## Recommended fix\n' +
      'The smallest safe next step. Do NOT change any files yet — this is an investigation.\n' +
      '\nDo not assert a cause without evidence. Separate hypothesis from evidence.'
  )
  parts.push(`\n---\n\n### Reported problem\n${description}`)
  parts.push(`\n### Project\n${summaryLine(e.summary)}`)

  if (e.relatedFiles.length) {
    parts.push(`\n### Files that may be relevant\n${e.relatedFiles.map((f) => `- ${f}`).join('\n')}`)
  }
  if (e.problems.length) {
    const lines = e.problems
      .slice(0, 20)
      .map((p) => `- ${p.severity >= 8 ? 'error' : 'warning'} ${p.path}:${p.line} — ${p.message}`)
      .join('\n')
    parts.push(`\n### Current Problems (from the editor)\n${lines}`)
  }
  if (e.recentCommits.length) {
    parts.push(`\n### Recent commits\n${e.recentCommits.slice(0, 10).map((c) => `- ${c}`).join('\n')}`)
  }
  if (e.hasUncommitted) {
    parts.push(
      `\n### Uncommitted changes (working diff, truncated)\n\`\`\`diff\n${e.diffSnippet}\n\`\`\``
    )
  }
  return parts.join('\n')
}
