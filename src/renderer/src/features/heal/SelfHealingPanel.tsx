import { useEffect, type JSX } from 'react'
import type { VerifyScript } from '@shared/engine'
import { MAX_HEAL_ATTEMPTS } from '@shared/engine'
import { useHealStore, type HealStep } from '@renderer/stores/healStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useAgentStore } from '@renderer/stores/agentStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useT } from '@renderer/i18n'

/**
 * Self-Healing Engine panel (spec §19). Pick which verification gates to run,
 * start the heal loop, and watch it verify → fix (via Claude Code) → re-verify,
 * bounded by MAX_HEAL_ATTEMPTS. Files changed during the run can be diffed, kept
 * or reverted to the pre-heal snapshot.
 */
export function SelfHealingPanel(): JSX.Element {
  const t = useT()
  const root = useWorkspaceStore((s) => s.root)
  const {
    available,
    selected,
    running,
    attempts,
    steps,
    outcome,
    checkpointId,
    healSessionId,
    refreshScripts,
    toggle,
    run,
    stop,
    undo
  } = useHealStore()

  const claudeReady = useAgentStore((s) =>
    s.providers.some((p) => p.id === 'claude-code' && p.state === 'authenticated')
  )
  const changed = useAgentStore((s) =>
    healSessionId ? (s.sessionsById[healSessionId]?.fileChanges ?? []) : []
  )
  const openDiff = useAgentStore((s) => s.openDiff)
  const openFile = useEditorStore((s) => s.openFile)

  useEffect(() => {
    if (root) void refreshScripts(root)
  }, [root, refreshScripts])

  if (!root) {
    return (
      <div className="sidebar heal">
        <div className="sidebar-header">
          <span>{t('heal.title')}</span>
        </div>
        <div className="empty-hint">{t('heal.noWorkspace')}</div>
      </div>
    )
  }

  return (
    <div className="sidebar heal">
      <div className="sidebar-header">
        <span>{t('heal.title')}</span>
      </div>

      <div className="heal-body">
        <div className="heal-intro">{t('heal.intro')}</div>

        {!claudeReady && <div className="heal-warn">{t('heal.noClaude')}</div>}

        <div className="heal-gates">
          <div className="heal-section-title">{t('heal.checks')}</div>
          {available.length === 0 ? (
            <div className="empty-hint">{t('heal.noScripts')}</div>
          ) : (
            available.map((s) => (
              <label key={s} className="heal-gate">
                <input
                  type="checkbox"
                  checked={selected.includes(s)}
                  disabled={running}
                  onChange={() => toggle(s)}
                />
                <code>npm run {s}</code>
              </label>
            ))
          )}
        </div>

        <div className="heal-actions">
          {running ? (
            <button className="heal-stop" onClick={stop}>
              {t('heal.stop')}
            </button>
          ) : (
            <button
              className="heal-run"
              disabled={available.length === 0 || selected.length === 0}
              onClick={() => void run()}
            >
              {t('heal.run')}
            </button>
          )}
          {attempts > 0 && (
            <span className="heal-attempts">
              {t('heal.attempt', { n: attempts, max: MAX_HEAL_ATTEMPTS })}
            </span>
          )}
        </div>

        {steps.length > 0 && (
          <div className="heal-steps">
            {steps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </div>
        )}

        {outcome !== 'idle' && !running && (
          <div className={`heal-outcome ${outcome}`}>
            {outcome === 'passed'
              ? t('heal.passed')
              : outcome === 'stopped'
                ? t('heal.stopped')
                : t('heal.failed')}
          </div>
        )}

        {changed.length > 0 && (
          <div className="heal-changes">
            <div className="heal-section-title">{t('heal.changed', { n: changed.length })}</div>
            {changed.map((f) => (
              <div key={f.path} className="heal-change" title={f.path}>
                <button
                  className="heal-change-path"
                  onClick={() => void openFile(f.path, f.path.split(/[\\/]/).pop() ?? f.path)}
                >
                  {f.path.split(/[\\/]/).pop()}
                </button>
                {f.changeType !== 'deleted' && healSessionId && (
                  <button className="heal-change-diff" onClick={() => openDiff(healSessionId, f.path)}>
                    {t('agent.viewDiff')}
                  </button>
                )}
              </div>
            ))}
            {checkpointId && (
              <button className="heal-undo" onClick={() => void undo()}>
                {t('heal.undo')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StepRow({ step }: { step: HealStep }): JSX.Element {
  const icon =
    step.status === 'running' ? '⟳' : step.status === 'ok' ? '✓' : step.status === 'fail' ? '✕' : '•'
  return (
    <div className={`heal-step ${step.status}`}>
      <span className="heal-step-icon">{icon}</span>
      <span className="heal-step-label">
        {step.label}
        {step.detail && <span className="heal-step-detail"> — {step.detail}</span>}
      </span>
    </div>
  )
}
