import { useEffect, useState, type JSX } from 'react'
import type { UsageStatus, UsageWindow } from '@shared/usage'
import { useUsageStore } from '@renderer/stores/usageStore'
import { useAgentStore } from '@renderer/stores/agentStore'
import { useUiStore } from '@renderer/stores/uiStore'
import { formatDuration } from '@renderer/lib/format'
import { useT } from '@renderer/i18n'

/**
 * Usage Monitor. Surfaces the *official* Claude Code usage signal (reset timers
 * from `rate_limit_event`), and — clearly separated — Lumixa's own local
 * activity. It never invents a usage percentage: when the CLI doesn't expose
 * one, the UI says "Unavailable".
 */
export function UsagePanel(): JSX.Element | null {
  const t = useT()
  const { settings, status, loading, error, lastFetchAt, activity, notice, init, refresh, dismissNotice } =
    useUsageStore()
  const claude = useAgentStore((s) => s.providers.find((p) => p.id === 'claude-code'))
  const now = useTick(1000)

  useEffect(() => {
    init()
  }, [init])

  if (!settings.enabled) return null

  const authRequired = claude?.state === 'unauthenticated'

  return (
    <div className="usage">
      <div className="usage-head">
        <span className="usage-title">{t('usage.title')}</span>
        <span className="usage-updated">
          {loading
            ? t('usage.refreshing')
            : lastFetchAt
              ? t('usage.updatedAgo', { s: Math.round((now - lastFetchAt) / 1000) })
              : ''}
        </span>
        <button className="usage-refresh" title={t('usage.refresh')} onClick={() => void refresh()}>
          ↻
        </button>
      </div>

      {notice && (
        <div className="usage-notice">
          ⚠ {notice}
          <button onClick={dismissNotice}>×</button>
        </div>
      )}

      <div className="usage-section-label">{t('usage.official')}</div>

      {authRequired ? (
        <AuthRequired />
      ) : error ? (
        <div className="usage-error">
          {t('usage.errorTitle')}
          <button onClick={() => void refresh()}>{t('usage.retry')}</button>
        </div>
      ) : (
        <OfficialUsage status={status} now={now} />
      )}

      <div className="usage-section-label activity">{t('usage.activityLabel')}</div>
      <div className="usage-activity-note">{t('usage.notOfficial')}</div>
      <div className="usage-activity">
        <Stat label={t('usage.sessions')} value={String(activity.sessions)} />
        <Stat label={t('usage.messages')} value={String(activity.messages)} />
        <Stat label={t('usage.toolCalls')} value={String(activity.toolCalls)} />
        <Stat label={t('usage.filesModified')} value={String(activity.filesModified)} />
        <Stat label={t('usage.runtime')} value={formatDuration(activity.runtimeMs)} />
      </div>
    </div>
  )
}

function OfficialUsage({ status, now }: { status: UsageStatus | null; now: number }): JSX.Element {
  const t = useT()
  if (!status || status.status === 'unavailable' || status.status === 'unknown') {
    return (
      <div className="usage-unavailable">
        <strong>{t('usage.unavailable')}</strong>
        <div>{status?.note ?? t('usage.unavailableHint')}</div>
      </div>
    )
  }
  return (
    <>
      <UsageWindowView title={t('usage.fiveHour')} win={status.fiveHour} now={now} />
      <UsageWindowView title={t('usage.weekly')} win={status.weekly} now={now} />
      {status.note && <div className="usage-note">{status.note}</div>}
    </>
  )
}

function UsageWindowView({
  title,
  win,
  now
}: {
  title: string
  win?: UsageWindow
  now: number
}): JSX.Element {
  const t = useT()
  if (!win) {
    return (
      <div className="usage-window">
        <div className="usage-window-title">{title}</div>
        <div className="usage-window-unavailable">{t('usage.unavailable')}</div>
      </div>
    )
  }
  const hasPct = typeof win.percentage === 'number'
  return (
    <div className="usage-window">
      <div className="usage-window-title">{title}</div>
      {hasPct ? (
        <>
          <div className="usage-bar">
            <div className="usage-bar-fill" style={{ width: `${win.percentage}%` }} />
          </div>
          <div className="usage-pct">{win.percentage}%</div>
        </>
      ) : (
        <div className="usage-window-unavailable">{t('usage.pctUnavailable')}</div>
      )}
      {typeof win.resetAt === 'number' ? (
        <div className="usage-reset">
          {t('usage.resetsIn', { time: formatDuration(win.resetAt - now) })}
        </div>
      ) : null}
    </div>
  )
}

function AuthRequired(): JSX.Element {
  const t = useT()
  const setTerminal = useUiStore((s) => s.setTerminal)
  return (
    <div className="usage-auth">
      <div>{t('usage.authRequired')}</div>
      <button onClick={() => setTerminal(true)}>{t('agent.openTerminal')}</button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="usage-stat">
      <span className="usage-stat-value">{value}</span>
      <span className="usage-stat-label">{label}</span>
    </div>
  )
}

/** Re-render every `ms` so countdowns tick. */
function useTick(ms: number): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}
