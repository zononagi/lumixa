import { useEffect, type JSX } from 'react'
import type { Confidence, WatcherCategory, WatcherFinding } from '@shared/brain'
import { useWatcherStore } from '@renderer/stores/watcherStore'
import { useBrainStore } from '@renderer/stores/brainStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useAgentStore } from '@renderer/stores/agentStore'
import { getActiveEditor } from '@renderer/lib/editorBridge'
import { useT, type TKey } from '@renderer/i18n'

/**
 * AI Code Watcher panel (spec §13-§14). Lists issues found by static analysis
 * during Project Brain indexing — no AI call to detect them. Each finding can be
 * explained or fixed via Claude Code on demand, or dismissed. Low-confidence
 * findings are hidden by default to avoid noise.
 */
const CATEGORY_ICON: Record<WatcherCategory, string> = {
  'error-handling': '🛡',
  unsafe: '⚠',
  race: '🔀',
  'dead-code': '🧹',
  suspicious: '🔍',
  types: '🏷',
  security: '🔒'
}

const CONF_LABEL: Record<Confidence, TKey> = {
  high: 'watch.high',
  medium: 'watch.medium',
  low: 'watch.low'
}

export function WatcherPanel(): JSX.Element {
  const t = useT()
  const root = useWorkspaceStore((s) => s.root)
  const lastIndexed = useBrainStore((s) => s.brain?.stats.lastIndexed)
  // No selector → re-renders on any watcher-state change (findings/ignore/filter).
  const { showLow, setShowLow, refresh, visible, ignored, clearIgnored } = useWatcherStore()

  useEffect(() => {
    if (root) void refresh(root)
  }, [root, lastIndexed, refresh])

  if (!root) {
    return (
      <div className="sidebar watcher">
        <div className="sidebar-header">
          <span>{t('watch.title')}</span>
        </div>
        <div className="empty-hint">{t('watch.noWorkspace')}</div>
      </div>
    )
  }

  const items = visible()

  return (
    <div className="sidebar watcher">
      <div className="sidebar-header">
        <span>{t('watch.title')}</span>
        <label className="watch-toggle" title={t('watch.showLowHint')}>
          <input type="checkbox" checked={showLow} onChange={(e) => setShowLow(e.target.checked)} />
          {t('watch.showLow')}
        </label>
      </div>

      <div className="watch-body">
        <div className="watch-summary">
          {items.length === 0 ? t('watch.clean') : t('watch.count', { n: items.length })}
          {ignored.size > 0 && (
            <button className="watch-clear-ignored" onClick={clearIgnored}>
              {t('watch.resetIgnored', { n: ignored.size })}
            </button>
          )}
        </div>

        {items.map((f) => (
          <FindingCard key={f.id} finding={f} />
        ))}
      </div>
    </div>
  )
}

function FindingCard({ finding }: { finding: WatcherFinding }): JSX.Element {
  const t = useT()
  const openFile = useEditorStore((s) => s.openFile)
  const ignore = useWatcherStore((s) => s.ignore)
  const claudeReady = useAgentStore((s) =>
    s.providers.some((p) => p.id === 'claude-code' && p.state === 'authenticated')
  )
  const requestPrefill = useAgentStore((s) => s.requestPrefill)

  const reveal = async (): Promise<void> => {
    await openFile(finding.path, finding.rel.split('/').pop() ?? finding.rel)
    // Best-effort jump to the line once the model is active.
    setTimeout(() => {
      const ed = getActiveEditor()?.editor
      ed?.revealLineInCenter(finding.line)
      ed?.setPosition({ lineNumber: finding.line, column: 1 })
    }, 120)
  }

  const ask = (verb: 'Explain' | 'Fix'): void => {
    const prompt =
      verb === 'Explain'
        ? `Explain this potential issue in ${finding.rel} (line ${finding.line}): ${finding.message}`
        : `Fix this issue in ${finding.rel} around line ${finding.line}: ${finding.message}. Keep the change minimal.`
    void requestPrefill(prompt, ['file'])
  }

  return (
    <div className={`watch-card ${finding.severity} ${finding.confidence}`}>
      <div className="watch-card-head">
        <span className="watch-cat">{CATEGORY_ICON[finding.category]}</span>
        <span className={`watch-conf ${finding.confidence}`}>{t(CONF_LABEL[finding.confidence])}</span>
        <button className="watch-loc" onClick={() => void reveal()} title={finding.path}>
          {finding.rel.split('/').pop()}:{finding.line}
        </button>
      </div>
      <div className="watch-msg">{finding.message}</div>
      <div className="watch-actions">
        {claudeReady && (
          <>
            <button onClick={() => ask('Explain')}>{t('watch.explain')}</button>
            <button className="primary" onClick={() => ask('Fix')}>
              {t('watch.fix')}
            </button>
          </>
        )}
        <button className="watch-ignore" onClick={() => ignore(finding.id)}>
          {t('watch.ignore')}
        </button>
      </div>
    </div>
  )
}
