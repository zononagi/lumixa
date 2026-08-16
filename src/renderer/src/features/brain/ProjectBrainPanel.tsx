import { useEffect, type JSX } from 'react'
import type { ImpactResult, ProjectSummary } from '@shared/brain'
import { useBrainStore } from '@renderer/stores/brainStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useAgentStore } from '@renderer/stores/agentStore'
import { useT, type TKey } from '@renderer/i18n'

/**
 * Project Brain panel (spec §8) — shows how well Lumixa understands the open
 * project: the detected stack summary, index stats, and the live Change Impact
 * Radar for the file currently in the editor. All from static analysis, so it
 * works with or without Claude Code.
 */
export function ProjectBrainPanel(): JSX.Element {
  const t = useT()
  const root = useWorkspaceStore((s) => s.root)
  const rootName = useWorkspaceStore((s) => s.rootName)
  const { brain, indexing, error, impact, impactPath, index, analyzeImpact } = useBrainStore()
  const activePath = useEditorStore((s) => s.activePath)

  // Recompute impact whenever the active file changes.
  useEffect(() => {
    if (root && activePath) void analyzeImpact(root, activePath)
  }, [root, activePath, brain?.stats.lastIndexed, analyzeImpact])

  if (!root) {
    return (
      <div className="sidebar brain">
        <div className="sidebar-header">
          <span>{t('brain.title')}</span>
        </div>
        <div className="empty-hint">{t('brain.noWorkspace')}</div>
      </div>
    )
  }

  return (
    <div className="sidebar brain">
      <div className="sidebar-header">
        <span>{t('brain.title')}</span>
        <button title={t('brain.reindex')} disabled={indexing} onClick={() => void index(root)}>
          ↻
        </button>
      </div>

      {indexing && !brain && <div className="brain-indexing">{t('brain.indexing')}</div>}
      {error && <div className="brain-error">{error}</div>}

      {brain && !brain.isProject && <div className="empty-hint">{t('brain.noProject')}</div>}

      {brain && (
        <div className="brain-body">
          <div className="brain-name">{brain.name ?? rootName}</div>

          <Summary summary={brain.summary} />

          <div className="brain-stats">
            <Stat label={t('brain.files')} value={brain.stats.files} />
            <Stat label={t('brain.components')} value={brain.stats.components} />
            <Stat label={t('brain.tests')} value={brain.stats.tests} />
            <Stat label={t('brain.deps')} value={brain.stats.dependencies} />
            <Stat label={t('brain.edges')} value={brain.stats.internalEdges} />
            <Stat label={t('brain.loc')} value={brain.stats.loc} />
          </div>

          <div className="brain-indexed">
            {t('brain.lastIndexed', { time: new Date(brain.stats.lastIndexed).toLocaleTimeString() })}
            {indexing && ` · ${t('brain.indexing')}`}
          </div>

          {brain.skippedSecrets.length > 0 && (
            <div className="brain-secrets" title={brain.skippedSecrets.join('\n')}>
              🔒 {t('brain.secrets', { n: brain.skippedSecrets.length })}
            </div>
          )}

          <ImpactRadar impact={impact} impactPath={impactPath} hasActive={!!activePath} />
        </div>
      )}
    </div>
  )
}

function Summary({ summary }: { summary: ProjectSummary }): JSX.Element {
  const t = useT()
  const rows: [TKey, string | undefined][] = [
    ['brain.sum.framework', summary.framework],
    ['brain.sum.language', summary.language],
    ['brain.sum.build', summary.build],
    ['brain.sum.state', summary.state],
    ['brain.sum.ui', summary.ui],
    ['brain.sum.testing', summary.testing],
    ['brain.sum.backend', summary.backend],
    ['brain.sum.runtime', summary.runtime],
    ['brain.sum.pm', summary.packageManager],
    ['brain.sum.arch', summary.architecture]
  ]
  const shown = rows.filter(([, v]) => v)
  if (shown.length === 0) return <div className="empty-hint">{t('brain.noSummary')}</div>
  return (
    <div className="brain-summary">
      <div className="brain-section-title">{t('brain.summary')}</div>
      {shown.map(([k, v]) => (
        <div key={k} className="brain-sum-row">
          <span className="brain-sum-key">{t(k)}</span>
          <span className="brain-sum-val">{v}</span>
        </div>
      ))}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="brain-stat">
      <span className="brain-stat-value">{value.toLocaleString()}</span>
      <span className="brain-stat-label">{label}</span>
    </div>
  )
}

function ImpactRadar({
  impact,
  impactPath,
  hasActive
}: {
  impact: ImpactResult | null
  impactPath: string | null
  hasActive: boolean
}): JSX.Element {
  const t = useT()
  const openFile = useEditorStore((s) => s.openFile)
  const files = useBrainStore((s) => s.brain?.files)
  const claudeAvailable = useAgentStore((s) =>
    s.providers.some((p) => p.id === 'claude-code' && p.state === 'authenticated')
  )
  const requestPrefill = useAgentStore((s) => s.requestPrefill)

  if (!hasActive) {
    return (
      <div className="brain-impact">
        <div className="brain-section-title">{t('brain.impact')}</div>
        <div className="empty-hint">{t('brain.impactHint')}</div>
      </div>
    )
  }
  if (!impact) {
    return (
      <div className="brain-impact">
        <div className="brain-section-title">{t('brain.impact')}</div>
        <div className="empty-hint">{t('brain.impactUntracked')}</div>
      </div>
    )
  }

  const absByRel = new Map((files ?? []).map((f) => [f.rel, f.path]))
  const open = (rel: string): void => {
    const abs = absByRel.get(rel)
    if (abs) void openFile(abs, rel.split('/').pop() ?? rel)
  }

  return (
    <div className="brain-impact">
      <div className="brain-section-title">{t('brain.impact')}</div>
      <div className="impact-target" title={impactPath ?? ''}>
        {impactPath?.split('/').pop()}
      </div>

      <div className={`impact-score ${impact.riskLevel}`}>
        <div className="impact-score-num">{impact.riskScore}</div>
        <div className="impact-score-meta">
          <span className={`impact-badge ${impact.riskLevel}`}>
            {t(`brain.risk.${impact.riskLevel}` as TKey)}
          </span>
          {impact.critical && <span className="impact-critical">⚠ {t('brain.critical')}</span>}
        </div>
      </div>

      <div className="impact-counts">
        <span className="impact-count high">
          🔴 {t('brain.direct', { n: impact.direct.length })}
        </span>
        <span className="impact-count med">
          🟡 {t('brain.indirect', { n: impact.indirect.length })}
        </span>
        <span className="impact-count">🧪 {t('brain.affTests', { n: impact.affectedTests.length })}</span>
      </div>

      {impact.reasons.length > 0 && (
        <ul className="impact-reasons">
          {impact.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      {impact.direct.length > 0 && (
        <details className="impact-files">
          <summary>{t('brain.affectedFiles')}</summary>
          {[...impact.direct, ...impact.indirect].slice(0, 40).map((rel) => (
            <button key={rel} className="impact-file" title={rel} onClick={() => open(rel)}>
              {directOrIndirect(impact, rel)} {rel}
            </button>
          ))}
        </details>
      )}

      {claudeAvailable && impact.affectedTests.length > 0 && (
        <button
          className="impact-run-tests"
          onClick={() =>
            void requestPrefill(
              `Run the tests affected by my change to ${impactPath} and report the results:\n${impact.affectedTests.join('\n')}`,
              ['file']
            )
          }
        >
          {t('brain.runAffected')}
        </button>
      )}
    </div>
  )
}

function directOrIndirect(impact: ImpactResult, rel: string): string {
  return impact.direct.includes(rel) ? '🔴' : '🟡'
}
