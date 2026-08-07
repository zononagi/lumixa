import { useEffect, useRef, type JSX } from 'react'
import * as monaco from 'monaco-editor'
import { useAppearanceStore } from '@renderer/stores/appearanceStore'

/**
 * Lightweight Markdown renderer for chat: fenced code blocks get real syntax
 * highlighting via Monaco's `colorize` (self-contained, theme-aware, no extra
 * deps), inline `code` gets styled, everything else is plain text.
 */

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
  ps1: 'powershell',
  yml: 'yaml',
  md: 'markdown',
  'c++': 'cpp',
  cs: 'csharp',
  golang: 'go'
}

interface Segment {
  type: 'text' | 'code'
  lang?: string
  content: string
}

/** Split text into alternating prose / fenced-code segments. */
function parse(md: string): Segment[] {
  const segments: Segment[] = []
  const re = /```([\w+#-]*)\r?\n?([\s\S]*?)```/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(md)) !== null) {
    if (m.index > last) segments.push({ type: 'text', content: md.slice(last, m.index) })
    segments.push({ type: 'code', lang: m[1] || 'plaintext', content: m[2].replace(/\n$/, '') })
    last = re.lastIndex
  }
  if (last < md.length) segments.push({ type: 'text', content: md.slice(last) })
  return segments
}

function CodeBlock({ code, lang }: { code: string; lang: string }): JSX.Element {
  const ref = useRef<HTMLPreElement>(null)
  const monacoTheme = useAppearanceStore((s) => s.monacoTheme)

  useEffect(() => {
    let cancelled = false
    const languageId = LANG_ALIASES[lang.toLowerCase()] ?? lang.toLowerCase()
    monaco.editor
      .colorize(code, languageId, {})
      .then((html) => {
        if (!cancelled && ref.current) ref.current.innerHTML = html
      })
      .catch(() => {
        if (!cancelled && ref.current) ref.current.textContent = code
      })
    return () => {
      cancelled = true
    }
  }, [code, lang, monacoTheme])

  return (
    <div className="code-block">
      <div className="code-lang">{lang}</div>
      <pre ref={ref} className="code-body">
        {code}
      </pre>
    </div>
  )
}

/** Render a text segment, styling inline `code` spans. */
function Prose({ text }: { text: string }): JSX.Element {
  const parts = text.split(/(`[^`]+`)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('`') && p.endsWith('`') && p.length > 2 ? (
          <code key={i} className="inline-code">
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  )
}

export function MarkdownMessage({ content }: { content: string }): JSX.Element {
  // Parsing is cheap; re-run each render so streamed text stays in sync.
  const segs = parse(content)

  return (
    <>
      {segs.map((s, i) =>
        s.type === 'code' ? (
          <CodeBlock key={i} code={s.content} lang={s.lang ?? 'plaintext'} />
        ) : (
          <Prose key={i} text={s.content} />
        )
      )}
    </>
  )
}
