import { memo, useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import { editor as monacoEditor } from 'monaco-editor'
import { useT } from '@renderer/i18n'

/**
 * Minimal, dependency-free Markdown renderer for Claude Code responses.
 *
 * Supports headings, bold/italic/inline-code, links, ordered/unordered lists,
 * blockquotes, horizontal rules and fenced code blocks. Fenced code is
 * syntax-highlighted with Monaco's `colorize()` — already bundled by the editor,
 * so this adds no new dependency — and gets a Copy button.
 *
 * SECURITY: inline text is rendered as React nodes (never innerHTML), so model
 * output can't inject markup. The only HTML injected is Monaco's own colorize
 * output, which HTML-escapes the source it tokenizes. Links are restricted to
 * http(s)/mailto and open in the OS browser via the main-process window handler,
 * never navigating the renderer.
 */
export const Markdown = memo(function Markdown({ text }: { text: string }): JSX.Element {
  return <div className="md">{renderBlocks(text)}</div>
})

// ---------------------------------------------------------------------------
// Block parsing
// ---------------------------------------------------------------------------

type Block =
  | { type: 'code'; lang: string; code: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'hr' }
  | { type: 'quote'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; text: string }

const RE_HEADING = /^(#{1,6})\s+(.*)$/
const RE_HR = /^(-{3,}|\*{3,}|_{3,})\s*$/
const RE_QUOTE = /^>\s?/
const RE_UL = /^\s*[-*+]\s+/
const RE_OL = /^\s*\d+[.)]\s+/

function isBlockStart(line: string): boolean {
  return (
    /^```/.test(line) ||
    RE_HEADING.test(line) ||
    RE_HR.test(line) ||
    RE_QUOTE.test(line) ||
    RE_UL.test(line) ||
    RE_OL.test(line)
  )
}

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block. Tolerates an unterminated fence (still streaming).
    const fence = line.match(/^```(.*)$/)
    if (fence) {
      const lang = fence[1].trim()
      const code: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++])
      i++ // consume the closing fence (or step past EOF)
      blocks.push({ type: 'code', lang, code: code.join('\n') })
      continue
    }

    if (!line.trim()) {
      i++
      continue
    }

    const h = line.match(RE_HEADING)
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, text: h[2] })
      i++
      continue
    }

    if (RE_HR.test(line)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    if (RE_QUOTE.test(line)) {
      const qs: string[] = []
      while (i < lines.length && RE_QUOTE.test(lines[i])) qs.push(lines[i++].replace(RE_QUOTE, ''))
      blocks.push({ type: 'quote', lines: qs })
      continue
    }

    if (RE_UL.test(line)) {
      const items: string[] = []
      while (i < lines.length && RE_UL.test(lines[i])) items.push(lines[i++].replace(RE_UL, ''))
      blocks.push({ type: 'ul', items })
      continue
    }

    if (RE_OL.test(line)) {
      const items: string[] = []
      while (i < lines.length && RE_OL.test(lines[i])) items.push(lines[i++].replace(RE_OL, ''))
      blocks.push({ type: 'ol', items })
      continue
    }

    // Paragraph: consecutive non-blank lines until the next block starts.
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) para.push(lines[i++])
    blocks.push({ type: 'p', text: para.join('\n') })
  }
  return blocks
}

function renderBlocks(src: string): ReactNode[] {
  return parseBlocks(src).map((b, idx) => {
    switch (b.type) {
      case 'code':
        return <CodeBlock key={idx} code={b.code} lang={b.lang} />
      case 'heading': {
        const Tag = `h${Math.min(b.level + 2, 6)}` as keyof JSX.IntrinsicElements
        return (
          <Tag key={idx} className="md-h">
            {renderInline(b.text, `h${idx}`)}
          </Tag>
        )
      }
      case 'hr':
        return <hr key={idx} className="md-hr" />
      case 'quote':
        return (
          <blockquote key={idx} className="md-quote">
            {renderInline(b.lines.join('\n'), `q${idx}`)}
          </blockquote>
        )
      case 'ul':
        return (
          <ul key={idx} className="md-list">
            {b.items.map((it, j) => (
              <li key={j}>{renderInline(it, `ul${idx}-${j}`)}</li>
            ))}
          </ul>
        )
      case 'ol':
        return (
          <ol key={idx} className="md-list">
            {b.items.map((it, j) => (
              <li key={j}>{renderInline(it, `ol${idx}-${j}`)}</li>
            ))}
          </ol>
        )
      case 'p':
        return (
          <p key={idx} className="md-p">
            {renderInline(b.text, `p${idx}`)}
          </p>
        )
    }
  })
}

// ---------------------------------------------------------------------------
// Inline parsing (code / bold / italic / links) — React nodes only, no HTML
// ---------------------------------------------------------------------------

const RE_INLINE =
  /(`[^`]+`)|(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*]+)\*)|(_([^_]+)_)|(\[([^\]]+)\]\(([^)]+)\))/

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let rest = text
  let k = 0
  while (rest.length) {
    const m = RE_INLINE.exec(rest)
    if (!m) {
      nodes.push(rest)
      break
    }
    if (m.index > 0) nodes.push(rest.slice(0, m.index))
    const key = `${keyPrefix}-${k++}`
    if (m[1]) {
      nodes.push(
        <code key={key} className="md-inline-code">
          {m[1].slice(1, -1)}
        </code>
      )
    } else if (m[2]) {
      nodes.push(<strong key={key}>{renderInline(m[3], key)}</strong>)
    } else if (m[4]) {
      nodes.push(<strong key={key}>{renderInline(m[5], key)}</strong>)
    } else if (m[6]) {
      nodes.push(<em key={key}>{renderInline(m[7], key)}</em>)
    } else if (m[8]) {
      nodes.push(<em key={key}>{renderInline(m[9], key)}</em>)
    } else if (m[10]) {
      const label = m[11]
      const url = m[12]
      if (/^(https?:|mailto:)/i.test(url)) {
        nodes.push(
          <a key={key} href={url} target="_blank" rel="noreferrer">
            {label}
          </a>
        )
      } else {
        nodes.push(label)
      }
    }
    rest = rest.slice(m.index + m[0].length)
  }
  return nodes
}

// ---------------------------------------------------------------------------
// Fenced code block: Monaco-highlighted + Copy
// ---------------------------------------------------------------------------

/** Map common fence info-strings to Monaco language ids. */
const LANG_ALIASES: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  shell: 'shell',
  console: 'shell',
  yml: 'yaml',
  md: 'markdown',
  ps1: 'powershell',
  'c++': 'cpp',
  cs: 'csharp',
  htm: 'html'
}

function toMonacoLang(lang: string): string {
  const l = lang.toLowerCase()
  return LANG_ALIASES[l] ?? l ?? 'plaintext'
}

function CodeBlock({ code, lang }: { code: string; lang: string }): JSX.Element {
  const t = useT()
  const ref = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    const el = ref.current
    if (!el) return
    monacoEditor
      .colorize(code, toMonacoLang(lang), { tabSize: 2 })
      .then((html) => {
        if (!cancelled && ref.current) ref.current.innerHTML = html
      })
      .catch(() => {
        // Highlighting is best-effort; the plain text is already rendered.
      })
    return () => {
      cancelled = true
    }
  }, [code, lang])

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <div className="md-code">
      <div className="md-code-head">
        <span className="md-code-lang">{lang || 'text'}</span>
        <button className="md-copy" onClick={() => void copy()}>
          {copied ? t('agent.copied') : t('agent.copy')}
        </button>
      </div>
      <pre className="md-code-body">
        <code ref={ref}>{code}</code>
      </pre>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Copy-whole-message button (used in the message header)
// ---------------------------------------------------------------------------

export function CopyButton({ text }: { text: string }): JSX.Element {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }
  return (
    <button className="md-copy-msg" title={t('agent.copyMessage')} onClick={() => void copy()}>
      {copied ? t('agent.copied') : t('agent.copy')}
    </button>
  )
}
