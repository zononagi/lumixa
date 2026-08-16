import { type JSX } from 'react'
import { useActivityStore } from '@renderer/stores/activityStore'
import { useUiStore, type LeftView } from '@renderer/stores/uiStore'
import { useT, type TKey } from '@renderer/i18n'
import {
  currentBySource,
  isActive,
  relTime,
  type Activity,
  type ActivitySource
} from './activity'

/**
 * Unified AI Activity Center (spec §46-§47, §58). One place showing what every
 * subsystem + Claude Code is doing right now (live), and a timestamped audit
 * trail of everything that happened this session.
 */
const SOURCE_META: Record<ActivitySource, { icon: string; label: TKey; view: LeftView }> = {
  claude: { icon: '✦', label: 'act.src.claude', view: 'agent' },
  brain: { icon: '🧠', label: 'act.src.brain', view: 'brain' },
  heal: { icon: '🩺', label: 'act.src.heal', view: 'heal' },
  bug: { icon: '🐞', label: 'act.src.bug', view: 'bug' },
  tests: { icon: '🧪', label: 'act.src.tests', view: 'tests' },
  watcher: { icon: '👁', label: 'act.src.watcher', view: 'watcher' }
}

export function AIActivityPanel(): JSX.Element {
  const t = useT()
  const entries = useActivityStore((s) => s.entries)
  const clear = useActivityStore((s) => s.clear)

  const live = currentBySource(entries).filter(isActive)

  return (
    <div className="sidebar activity">
      <div className="sidebar-header">
        <span>{t('act.title')}</span>
        {entries.length > 0 && (
          <button title={t('act.clear')} onClick={clear}>
            🗑
          </button>
        )}
      </div>

      <div className="act-body">
        <div className="act-section-title">{t('act.live')}</div>
        {live.length === 0 ? (
          <div className="act-idle">{t('act.idle')}</div>
        ) : (
          live.map((a) => <LiveRow key={a.source} activity={a} />)
        )}

        <div className="act-section-title">{t('act.log')}</div>
        {entries.length === 0 ? (
          <div className="empty-hint">{t('act.empty')}</div>
        ) : (
          entries.map((a) => <LogRow key={a.id} activity={a} />)
        )}
      </div>
    </div>
  )
}

function LiveRow({ activity }: { activity: Activity }): JSX.Element {
  const t = useT()
  const setLeftView = useUiStore((s) => s.setLeftView)
  const meta = SOURCE_META[activity.source]
  return (
    <button className="act-live" onClick={() => setLeftView(meta.view)}>
      <span className="act-spinner">⟳</span>
      <span className="act-live-src">
        {meta.icon} {t(meta.label)}
      </span>
      <span className="act-live-msg">{t(activity.messageKey, activity.vars)}</span>
    </button>
  )
}

function LogRow({ activity }: { activity: Activity }): JSX.Element {
  const t = useT()
  const meta = SOURCE_META[activity.source]
  const icon =
    activity.status === 'running'
      ? '⟳'
      : activity.status === 'done'
        ? '✓'
        : activity.status === 'error'
          ? '✕'
          : '•'
  return (
    <div className={`act-log ${activity.status}`}>
      <span className="act-log-time">{relTime(activity.ts)}</span>
      <span className="act-log-icon">{icon}</span>
      <span className="act-log-src">{meta.icon}</span>
      <span className="act-log-msg">{t(activity.messageKey, activity.vars)}</span>
    </div>
  )
}
