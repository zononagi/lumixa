import { useEffect, useState, type JSX } from 'react'
import type { ProjectHealth } from '@shared/ipc'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useMarkersStore } from '@renderer/features/problems/markersStore'
import { useT } from '@renderer/i18n'

/**
 * Project Health + Dependency Explorer. Scans package.json and the source tree
 * (in the main process) to show declared dependencies, how many files import
 * each, unused/missing dependencies, and a diagnostics summary. No AI.
 */
export function HealthPanel(): JSX.Element {
  const root = useWorkspaceStore((s) => s.root)
  const problems = useMarkersStore((s) => s.problems)
  const t = useT()
  const [health, setHealth] = useState<ProjectHealth | null>(null)
  const [loading, setLoading] = useState(false)

  const scan = async (): Promise<void> => {
    if (!root) return
    setLoading(true)
    try {
      setHealth(await window.lumixa.project.health(root))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void scan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root])

  const errors = problems.filter((p) => p.severity >= 8).length
  const warnings = problems.filter((p) => p.severity < 8).length

  if (!root) {
    return (
      <div className="sidebar">
        <div className="sidebar-header">
          <span>{t('health.title')}</span>
        </div>
        <div className="empty-hint">{t('health.noFolder')}</div>
      </div>
    )
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>{t('health.title')}</span>
        <button title={t('health.rescan')} onClick={() => void scan()}>
          ↻
        </button>
      </div>
      <div className="health">
        {loading && <div className="empty-hint">{t('health.scanning')}</div>}
        {health && !health.isProject && <div className="empty-hint">{t('health.noPackage')}</div>}
        {health?.error && <div className="git-error">{health.error}</div>}

        {health?.isProject && (
          <>
            <div className="health-summary">
              <div className={`health-stat ${errors ? 'bad' : 'ok'}`}>
                {errors ? '✕' : '✓'} {t('health.errors', { n: errors })}
              </div>
              <div className={`health-stat ${warnings ? 'warn' : 'ok'}`}>
                ⚠ {t('health.warnings', { n: warnings })}
              </div>
              <div className="health-stat">📄 {t('health.files', { n: health.fileCount })}</div>
              {health.unusedDependencies.length > 0 && (
                <div className="health-stat warn">
                  ⚠ {t('health.unused', { n: health.unusedDependencies.length })}
                </div>
              )}
              {health.missingDependencies.length > 0 && (
                <div className="health-stat bad">
                  ✕ {t('health.missing', { n: health.missingDependencies.length })}
                </div>
              )}
            </div>

            <div className="health-section">{t('health.dependencies')}</div>
            <div className="dep-list">
              {health.dependencies.map((d) => (
                <div key={d.name} className="dep-row" title={`${d.name}@${d.version}`}>
                  <span className="dep-name">{d.name}</span>
                  {d.dev && <span className="dep-tag">dev</span>}
                  <span className="spacer" />
                  <span className={`dep-used ${d.usedBy === 0 && !d.dev ? 'unused' : ''}`}>
                    {d.usedBy === 0 ? t('health.unusedTag') : t('health.usedBy', { n: d.usedBy })}
                  </span>
                </div>
              ))}
            </div>

            {health.missingDependencies.length > 0 && (
              <>
                <div className="health-section">{t('health.missingTitle')}</div>
                <div className="dep-list">
                  {health.missingDependencies.map((m) => (
                    <div key={m} className="dep-row">
                      <span className="dep-name">{m}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
