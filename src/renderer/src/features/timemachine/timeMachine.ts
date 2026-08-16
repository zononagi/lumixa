import type { BlameInfo, CommitInfo } from '@shared/ipc'

/**
 * Git Time Machine (spec §25-§26). Pure helpers: pull PR/issue references out of
 * commit messages, and build the "why does this code exist?" prompt handed to
 * Claude Code from real git evidence (blame + introducing commit + file
 * history). Unit-tested.
 */

/** Unique `#123` references (PRs/issues) mentioned in text, in order. */
export function extractRefs(text: string): number[] {
  const out: number[] = []
  const seen = new Set<number>()
  for (const m of text.matchAll(/#(\d{1,7})\b/g)) {
    const n = Number(m[1])
    if (!seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  return out
}

export function buildWhyPrompt(
  fileName: string,
  line: number,
  blame: BlameInfo,
  commit: CommitInfo | null,
  history: string[]
): string {
  const parts: string[] = []
  parts.push(
    `Explain why the code at \`${fileName}\` line ${line} exists: its original purpose, and ` +
      `whether removing or changing it is risky. Read the file and the commit if that helps. ` +
      `Answer with three short sections: **Original purpose**, **Why it's here**, **Risk of removing**. ` +
      `Base it on the git evidence below; if the evidence is thin, say so rather than guessing.`
  )
  parts.push(
    `\n### Blame for the line\n${blame.shortHash} · ${blame.author} · ${blame.date} · ${blame.summary}`
  )
  if (commit) {
    const refs = extractRefs(`${commit.subject}\n${commit.body}`)
    parts.push(
      `\n### Introducing commit ${commit.shortHash} (${commit.date})\n${commit.subject}` +
        (commit.body ? `\n\n${commit.body}` : '') +
        (refs.length ? `\n\nReferenced PR/issues: ${refs.map((n) => `#${n}`).join(', ')}` : '')
    )
  }
  if (history.length) {
    parts.push(`\n### Recent history of this file\n${history.slice(0, 10).join('\n')}`)
  }
  return parts.join('\n')
}
