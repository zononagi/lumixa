import type { JSX } from 'react'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useChatStore } from '@renderer/stores/chatStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useT } from '@renderer/i18n'

/** Bottom status bar: workspace, model, live token usage, dirty indicator. */
export function StatusBar(): JSX.Element {
  const rootName = useWorkspaceStore((s) => s.rootName)
  const selectedModel = useSettingsStore((s) => s.selectedModel)
  const usage = useChatStore((s) => s.lastUsage)
  const streaming = useChatStore((s) => s.streaming)
  const activeTab = useEditorStore((s) => s.tabs.find((t) => t.path === s.activePath))
  const t = useT()

  return (
    <div className="statusbar">
      <span>{rootName ? `📁 ${rootName}` : t('status.noFolder')}</span>
      {activeTab && <span>{activeTab.dirty ? t('status.unsaved') : t('status.saved')}</span>}
      <div className="spacer" />
      {usage && (
        <span>
          ↑{usage.inputTokens ?? '–'} ↓{usage.outputTokens ?? '–'} tok
        </span>
      )}
      <span>{streaming ? t('status.generating') : (selectedModel ?? t('status.noModel'))}</span>
      <span>Lumixa</span>
    </div>
  )
}
