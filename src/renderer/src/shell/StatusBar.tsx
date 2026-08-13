import type { JSX } from 'react'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useUsageStore } from '@renderer/stores/usageStore'
import { useUiStore } from '@renderer/stores/uiStore'
import { formatDuration } from '@renderer/lib/format'
import { useT } from '@renderer/i18n'

/** Bottom status bar: workspace, dirty indicator, and a compact usage readout. */
export function StatusBar(): JSX.Element {
  const rootName = useWorkspaceStore((s) => s.rootName)
  const activeTab = useEditorStore((s) => s.tabs.find((t) => t.path === s.activePath))
  const t = useT()

  return (
    <div className="statusbar">
      <span>{rootName ? `📁 ${rootName}` : t('status.noFolder')}</span>
      {activeTab && <span>{activeTab.dirty ? t('status.unsaved') : t('status.saved')}</span>}
      <div className="spacer" />
      <UsageStatusItem />
      <span>Lumixa</span>
    </div>
  )
}

/** Compact usage readout. Percentages are shown ONLY if officially exposed;
 *  otherwise it honestly reads "Usage —". Clicking opens the AI Agent panel. */
function UsageStatusItem(): JSX.Element | null {
  const t = useT()
  const settings = useUsageStore((s) => s.settings)
  const status = useUsageStore((s) => s.status)
  const setLeftView = useUiStore((s) => s.setLeftView)
  if (!settings.enabled || !settings.showInStatusBar) return null

  const fivePct = status?.fiveHour?.percentage
  const weekPct = status?.weekly?.percentage
  const fiveReset = status?.fiveHour?.resetAt
  const weekReset = status?.weekly?.resetAt

  let text: string
  if (typeof fivePct === 'number' || typeof weekPct === 'number') {
    const five = typeof fivePct === 'number' ? `5h ${fivePct}%` : '5h —'
    const week = typeof weekPct === 'number' ? `Weekly ${weekPct}%` : 'Weekly —'
    text = `${five} | ${week}`
  } else if (typeof fiveReset === 'number') {
    text = t('usage.sbReset', { time: formatDuration(fiveReset - Date.now()) })
  } else {
    text = t('usage.sbUnavailable')
  }

  return (
    <span
      className="statusbar-usage"
      title={t('usage.sbTitle')}
      onClick={() => setLeftView('agent')}
      style={{ cursor: 'pointer' }}
    >
      Claude Code · {text}
    </span>
  )
}
