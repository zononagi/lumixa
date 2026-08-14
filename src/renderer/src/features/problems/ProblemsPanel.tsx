import { useState, type JSX } from 'react'
import { useMarkersStore, type Problem } from './markersStore'
import { getActiveEditor, runEditorAction } from '@renderer/lib/editorBridge'
import { explainDiagnostic } from '@renderer/features/intelligence/errorExplainer'
import { useAgentStore } from '@renderer/stores/agentStore'
import { useUiStore } from '@renderer/stores/uiStore'
import { useT, useI18nStore } from '@renderer/i18n'

/**
 * Problems tab — lists Monaco diagnostics (errors/warnings) for the open file,
 * jumps to the source line, and (spec §31–§34) expands each into a beginner
 * "What / Why / How to fix?" explanation with a one-click fix and an optional
 * "Ask Claude Code" escape hatch. The explanation is static analysis, not AI.
 */
export function ProblemsPanel(): JSX.Element {
  const problems = useMarkersStore((s) => s.problems)
  const [openIdx, setOpenIdx] = useState<number | null>(null)

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
        <div key={`${p.resource}:${p.line}:${p.column}:${i}`} className="problem-item">
          <div
            className="problem-row"
            onClick={() => {
              reveal(p.line, p.column)
              setOpenIdx(openIdx === i ? null : i)
            }}
          >
            <span className={`problem-sev ${p.severity >= 8 ? 'error' : 'warn'}`}>
              {p.severity >= 8 ? '✕' : '⚠'}
            </span>
            <span className="problem-msg">{p.message}</span>
            <span className="problem-loc">
              {p.path}:{p.line}
            </span>
            <span className="problem-chevron">{openIdx === i ? '▾' : '▸'}</span>
          </div>
          {openIdx === i && <ProblemExplanation problem={p} />}
        </div>
      ))}
    </div>
  )
}

function ProblemExplanation({ problem }: { problem: Problem }): JSX.Element {
  const t = useT()
  const rawLocale = useI18nStore((s) => s.locale)
  const locale = rawLocale === 'ja' ? 'ja' : 'en'
  const claudeAvailable = useAgentStore((s) =>
    s.providers.some((p) => p.id === 'claude-code' && p.state === 'authenticated')
  )
  const setLeftView = useUiStore((s) => s.setLeftView)

  const ex = explainDiagnostic(
    { message: problem.message, code: problem.code, severity: problem.severity },
    locale
  )

  const fix = (): void => {
    getActiveEditor()?.editor.setPosition({ lineNumber: problem.line, column: problem.column })
    runEditorAction(ex.action === 'organizeImports' ? 'editor.action.organizeImports' : 'editor.action.quickFix')
  }

  return (
    <div className="problem-explain">
      <span className="problem-cat">{ex.categoryLabel}</span>
      <div className="pe-line">
        <strong>{t('problems.what')}</strong> {ex.what}
      </div>
      <div className="pe-line">
        <strong>{t('problems.why')}</strong> {ex.why}
      </div>
      <div className="pe-line">
        <strong>{t('problems.fix')}</strong> {ex.fix}
      </div>
      <div className="pe-actions">
        {ex.action && (
          <button className="pe-btn primary" onClick={fix}>
            {t(ex.action === 'organizeImports' ? 'problems.organizeImports' : 'problems.quickFix')}
          </button>
        )}
        {claudeAvailable && (
          <button className="pe-btn" onClick={() => setLeftView('agent')}>
            {t('problems.askClaude')}
          </button>
        )}
      </div>
      <details className="pe-tech">
        <summary>{t('problems.technical')}</summary>
        <code>
          {ex.technical}
          {problem.code ? ` (${problem.code})` : ''}
        </code>
      </details>
    </div>
  )
}
