import type { JSX } from 'react'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useChatStore } from '@renderer/stores/chatStore'
import { useEditorStore } from '@renderer/stores/editorStore'

/** Bottom status bar: workspace, model, live token usage, dirty indicator. */
export function StatusBar(): JSX.Element {
  const rootName = useWorkspaceStore((s) => s.rootName)
  const selectedModel = useSettingsStore((s) => s.selectedModel)
  const usage = useChatStore((s) => s.lastUsage)
  const streaming = useChatStore((s) => s.streaming)
  const activeTab = useEditorStore((s) =>
    s.tabs.find((t) => t.path === s.activePath)
  )

  return (
    <div className="statusbar">
      <span>{rootName ? `📁 ${rootName}` : 'No folder open'}</span>
      {activeTab && <span>{activeTab.dirty ? '● Unsaved' : 'Saved'}</span>}
      <div className="spacer" />
      {usage && (
        <span title="Tokens from the last response">
          ↑{usage.inputTokens ?? '–'} ↓{usage.outputTokens ?? '–'} tok
        </span>
      )}
      <span>{streaming ? 'Generating…' : (selectedModel ?? 'No model')}</span>
      <span>Lumixa</span>
    </div>
  )
}
