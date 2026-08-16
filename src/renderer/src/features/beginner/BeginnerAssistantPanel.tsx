import { useMemo, useState, type JSX } from 'react'
import { useMarkersStore, type Problem } from '@renderer/features/problems/markersStore'
import { explainDiagnostic } from '@renderer/features/intelligence/errorExplainer'
import { useBrainStore } from '@renderer/stores/brainStore'
import { useAgentStore } from '@renderer/stores/agentStore'
import { useUiStore } from '@renderer/stores/uiStore'
import { notify } from '@renderer/stores/notifyStore'
import { runInTerminal } from '@renderer/lib/terminalBridge'
import { checkDanger } from '@renderer/lib/danger'
import { useT, useI18nStore } from '@renderer/i18n'
import { commandHelp, installCommandFor } from './beginner'

/**
 * Beginner Assistant panel (spec §38-§39). Two beginner needs in one place:
 * "what does this command do (and is it safe to run)?" with a real Run button,
 * and "translate this error into plain language" with a one-click fix. All the
 * explanation logic is reused from explainCommand + errorExplainer (no AI).
 */
export function BeginnerAssistantPanel(): JSX.Element {
  const t = useT()
  const rawLocale = useI18nStore((s) => s.locale)
  const locale = rawLocale === 'ja' ? 'ja' : 'en'
  const [cmd, setCmd] = useState('')
  const problems = useMarkersStore((s) => s.problems)
  const setTerminal = useUiStore((s) => s.setTerminal)

  const help = useMemo(() => (cmd.trim() ? commandHelp(cmd, locale) : null), [cmd, locale])

  const run = (command: string): void => {
    const d = checkDanger(command)
    if (d.dangerous && !window.confirm(t('terminal.dangerConfirm', { cmd: command, reason: d.reason ?? '' }))) {
      return
    }
    setTerminal(true)
    setTimeout(() => {
      if (!runInTerminal(command)) notify('info', t('beginner.openTerminalFirst'))
    }, 150)
  }

  const errors = problems.filter((p) => p.severity >= 8).slice(0, 8)

  return (
    <div className="sidebar beginner">
      <div className="sidebar-header">
        <span>{t('beginner.title')}</span>
      </div>

      <div className="beginner-body">
        {/* Command explainer */}
        <div className="bg-section-title">{t('beginner.cmdTitle')}</div>
        <input
          className="bg-cmd-input"
          value={cmd}
          placeholder={t('beginner.cmdPlaceholder')}
          onChange={(e) => setCmd(e.target.value)}
        />
        {help && (
          <div className="bg-cmd-help">
            <div className="bg-cmd-explain">
              {help.explanation ?? t('beginner.cmdUnknown')}
            </div>
            <div className={`bg-safety ${help.dangerous ? 'danger' : 'safe'}`}>
              {help.dangerous ? `⚠ ${help.reason}` : `✓ ${t('beginner.safe')}`}
            </div>
            <div className="bg-cmd-actions">
              <button className="bg-run" onClick={() => run(cmd.trim())}>
                {t('beginner.run')}
              </button>
              <button
                className="bg-copy"
                onClick={() => void navigator.clipboard?.writeText(cmd.trim())}
              >
                {t('beginner.copy')}
              </button>
            </div>
          </div>
        )}

        {/* Error translator */}
        <div className="bg-section-title">{t('beginner.errTitle')}</div>
        {errors.length === 0 ? (
          <div className="empty-hint">{t('beginner.noErrors')}</div>
        ) : (
          errors.map((p, i) => (
            <ErrorCard key={`${p.resource}:${p.line}:${i}`} problem={p} locale={locale} onRun={run} />
          ))
        )}
      </div>
    </div>
  )
}

function ErrorCard({
  problem,
  locale,
  onRun
}: {
  problem: Problem
  locale: 'ja' | 'en'
  onRun: (cmd: string) => void
}): JSX.Element {
  const t = useT()
  const packageManager = useBrainStore((s) => s.brain?.summary.packageManager)
  const claudeReady = useAgentStore((s) =>
    s.providers.some((p) => p.id === 'claude-code' && p.state === 'authenticated')
  )
  const requestPrefill = useAgentStore((s) => s.requestPrefill)

  const ex = explainDiagnostic(
    { message: problem.message, code: problem.code, severity: problem.severity },
    locale
  )
  const isMissingModule = ex.category === 'module-not-found'

  return (
    <div className="bg-err">
      <div className="bg-err-cat">{ex.categoryLabel}</div>
      <div className="bg-err-what">{ex.what}</div>
      <div className="bg-err-fix">
        <strong>{t('problems.fix')}</strong> {ex.fix}
      </div>
      <div className="bg-err-actions">
        {isMissingModule && (
          <button className="bg-run" onClick={() => onRun(installCommandFor(packageManager))}>
            {t('beginner.fixInstall')}
          </button>
        )}
        {claudeReady && (
          <button
            className="bg-ask"
            onClick={() =>
              void requestPrefill(
                `Explain and fix this error in plain language: ${problem.message}${problem.code ? ` (${problem.code})` : ''}`,
                ['file', 'problems']
              )
            }
          >
            {t('beginner.explainFix')}
          </button>
        )}
      </div>
      <details className="bg-err-tech">
        <summary>{t('problems.technical')}</summary>
        <code>
          {ex.technical}
          {problem.code ? ` (${problem.code})` : ''}
        </code>
      </details>
    </div>
  )
}
