import { useEffect, useMemo, type JSX } from 'react'
import { useBrainStore } from '@renderer/stores/brainStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useAgentStore } from '@renderer/stores/agentStore'
import { useTestGuardianStore } from '@renderer/stores/testGuardianStore'
import { useT } from '@renderer/i18n'
import { buildGenerateTestsPrompt, computeCoverage, type UncoveredFile } from './coverage'

/**
 * Test Guardian panel (spec §22-§24). Uses the Project Brain graph to show which
 * source files no test touches, flags the tests affected by the file in focus
 * (from Change Impact), runs the suite, and generates tests via Claude Code.
 */
export function TestGuardianPanel(): JSX.Element {
  const t = useT()
  const root = useWorkspaceStore((s) => s.root)
  const files = useBrainStore((s) => s.brain?.files)
  const framework = useBrainStore((s) => s.brain?.summary.testing)
  const impact = useBrainStore((s) => s.impact)
  const { hasTestScript, running, result, checkScript, runTests } = useTestGuardianStore()

  useEffect(() => {
    if (root) void checkScript(root)
  }, [root, checkScript])

  const coverage = useMemo(() => (files ? computeCoverage(files) : null), [files])

  if (!root) {
    return (
      <div className="sidebar tests">
        <div className="sidebar-header">
          <span>{t('tg.title')}</span>
        </div>
        <div className="empty-hint">{t('tg.noWorkspace')}</div>
      </div>
    )
  }

  return (
    <div className="sidebar tests">
      <div className="sidebar-header">
        <span>{t('tg.title')}</span>
      </div>

      <div className="tg-body">
        {coverage && (
          <div className="tg-coverage">
            <div className="tg-cov-top">
              <span className="tg-cov-pct">
                {coverage.percent === null ? '—' : `${coverage.percent}%`}
              </span>
              <span className="tg-cov-meta">
                {t('tg.covered', { c: coverage.covered, n: coverage.testable })} ·{' '}
                {t('tg.testFiles', { n: coverage.testFiles })}
              </span>
            </div>
            <div className="tg-cov-bar">
              <div className="tg-cov-fill" style={{ width: `${coverage.percent ?? 0}%` }} />
            </div>
          </div>
        )}

        <div className="tg-run">
          <button
            className="tg-run-btn"
            disabled={running || hasTestScript === false}
            onClick={() => void runTests()}
          >
            {running ? t('tg.running') : t('tg.run')}
          </button>
          {hasTestScript === false && <span className="tg-hint">{t('tg.noScript')}</span>}
          {result && (
            <span className={`tg-result ${result.ok ? 'ok' : 'fail'}`}>
              {result.ok ? t('tg.pass') : t('tg.fail')}
            </span>
          )}
        </div>

        {impact && impact.affectedTests.length > 0 && (
          <AffectedTests tests={impact.affectedTests} target={impact.target} />
        )}

        {coverage && (
          <div className="tg-uncovered">
            <div className="tg-section-title">
              {t('tg.uncovered', { n: coverage.uncovered.length })}
            </div>
            {coverage.uncovered.length === 0 ? (
              <div className="empty-hint">{t('tg.allCovered')}</div>
            ) : (
              coverage.uncovered.slice(0, 60).map((f) => (
                <UncoveredRow key={f.rel} file={f} framework={framework} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AffectedTests({ tests, target }: { tests: string[]; target: string }): JSX.Element {
  const t = useT()
  const openFile = useEditorStore((s) => s.openFile)
  const files = useBrainStore((s) => s.brain?.files)
  const open = (rel: string): void => {
    const abs = files?.find((f) => f.rel === rel)?.path
    if (abs) void openFile(abs, rel.split('/').pop() ?? rel)
  }
  return (
    <div className="tg-affected">
      <div className="tg-section-title">{t('tg.affected', { file: target.split('/').pop() ?? target })}</div>
      {tests.map((rel) => (
        <button key={rel} className="tg-file" title={rel} onClick={() => open(rel)}>
          🧪 {rel}
        </button>
      ))}
    </div>
  )
}

function UncoveredRow({
  file,
  framework
}: {
  file: UncoveredFile
  framework: string | undefined
}): JSX.Element {
  const t = useT()
  const openFile = useEditorStore((s) => s.openFile)
  const claudeReady = useAgentStore((s) =>
    s.providers.some((p) => p.id === 'claude-code' && p.state === 'authenticated')
  )
  const requestPrefill = useAgentStore((s) => s.requestPrefill)

  return (
    <div className="tg-uncov-row">
      <button
        className="tg-file"
        title={file.rel}
        onClick={() => void openFile(file.path, file.rel.split('/').pop() ?? file.rel)}
      >
        {file.rel}
      </button>
      {claudeReady && (
        <button
          className="tg-gen"
          onClick={() => void requestPrefill(buildGenerateTestsPrompt(file.rel, framework), [], true)}
        >
          {t('tg.generate')}
        </button>
      )}
    </div>
  )
}
