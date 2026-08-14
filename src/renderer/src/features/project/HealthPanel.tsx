import { useEffect, useState, type JSX } from 'react'
import type { EnvToolStatus, ProjectHealth } from '@shared/ipc'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useMarkersStore } from '@renderer/features/problems/markersStore'
import { detectProjectType, entryPointCandidates } from '@renderer/features/intelligence/projectInsight'
import { useT, useI18nStore } from '@renderer/i18n'

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
        <Onboarding health={health} />
        <EnvironmentDoctor />

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

/** Project Onboarding (spec §66, §67): infer the project type and offer the
 *  entry-point files that actually exist as a "start here" list (§14). */
function Onboarding({ health }: { health: ProjectHealth | null }): JSX.Element | null {
  const t = useT()
  const root = useWorkspaceStore((s) => s.root)
  const openFile = useEditorStore((s) => s.openFile)
  const [entries, setEntries] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!root) return
      // Shallow-scan root + src to confirm which candidate entry points exist.
      const existing = new Set<string>()
      try {
        for (const e of await window.lumixa.fs.readDir(root)) existing.add(e.name)
        if (existing.has('src')) {
          for (const e of await window.lumixa.fs.readDir(`${root}/src`)) existing.add(`src/${e.name}`)
        }
      } catch {
        /* ignore */
      }
      const found = entryPointCandidates().filter((c) => existing.has(c))
      if (!cancelled) setEntries(found)
    })()
    return () => {
      cancelled = true
    }
  }, [root])

  if (!health?.isProject) return null
  const type = detectProjectType(health.dependencies.map((d) => d.name))

  return (
    <div className="onboarding">
      <div className="onboarding-type">
        {t('onboard.looksLike')} <strong>{type}</strong>
      </div>
      {entries.length > 0 && (
        <>
          <div className="onboarding-start">{t('onboard.startHere')}</div>
          <div className="onboarding-entries">
            {entries.map((rel) => (
              <button
                key={rel}
                className="onboarding-entry"
                onClick={() => void openFile(`${root}/${rel}`, rel.split('/').pop() ?? rel)}
              >
                {rel}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const INSTALL_URLS: Record<string, string> = {
  node: 'https://nodejs.org',
  npm: 'https://nodejs.org',
  git: 'https://git-scm.com/downloads',
  python: 'https://www.python.org/downloads/',
  pnpm: 'https://pnpm.io/installation',
  yarn: 'https://yarnpkg.com/getting-started/install'
}

/** Environment Doctor (spec §9–§11): report installed tools + versions. Never
 *  installs anything — only offers a Learn More link (§10). */
function EnvironmentDoctor(): JSX.Element {
  const t = useT()
  const ja = useI18nStore((s) => s.locale) === 'ja'
  const [tools, setTools] = useState<EnvToolStatus[] | null>(null)

  const run = async (): Promise<void> => setTools(await window.lumixa.env.check())
  useEffect(() => {
    void run()
  }, [])

  return (
    <div className="env-doctor">
      <div className="health-section">
        {t('env.title')}
        <button onClick={() => void run()}>{t('health.rescan')}</button>
      </div>
      {!tools ? (
        <div className="empty-hint">{t('env.checking')}</div>
      ) : (
        <div className="env-list">
          {tools.map((tool) => (
            <div key={tool.id} className={`env-item ${tool.installed ? 'ok' : 'missing'}`}>
              <span className="env-mark">{tool.installed ? '✓' : '✕'}</span>
              <span className="env-name">{tool.name}</span>
              {tool.installed ? (
                <span className="env-ver">{tool.version ?? ''}</span>
              ) : (
                <>
                  <span className="env-what">{ja ? tool.whatJa : tool.whatEn}</span>
                  {INSTALL_URLS[tool.id] && (
                    <a className="env-link" href={INSTALL_URLS[tool.id]} target="_blank" rel="noreferrer">
                      {t('env.learnMore')}
                    </a>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
