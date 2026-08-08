import type { JSX } from 'react'
import { useMarkersStore } from './markersStore'
import { getActiveEditor } from '@renderer/lib/editorBridge'

/**
 * Problems tab — lists Monaco diagnostics (errors/warnings) for the open file
 * and jumps to the source line on click.
 */
export function ProblemsPanel(): JSX.Element {
  const problems = useMarkersStore((s) => s.problems)

  const reveal = (line: number, column: number): void => {
    const active = getActiveEditor()
    if (!active) return
    active.editor.revealLineInCenter(line)
    active.editor.setPosition({ lineNumber: line, column })
    active.editor.focus()
  }

  if (problems.length === 0) {
    return <div className="problems-empty">No problems detected.</div>
  }

  return (
    <div className="problems">
      {problems.map((p, i) => (
        <div
          key={`${p.resource}:${p.line}:${p.column}:${i}`}
          className="problem-row"
          onClick={() => reveal(p.line, p.column)}
        >
          <span className={`problem-sev ${p.severity >= 8 ? 'error' : 'warn'}`}>
            {p.severity >= 8 ? '✕' : '⚠'}
          </span>
          <span className="problem-msg">{p.message}</span>
          <span className="problem-loc">
            {p.path}:{p.line}
          </span>
        </div>
      ))}
    </div>
  )
}
