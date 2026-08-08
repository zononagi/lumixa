import type { JSX } from 'react'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useT } from '@renderer/i18n'

/** Bottom status bar: workspace and dirty indicator. */
export function StatusBar(): JSX.Element {
  const rootName = useWorkspaceStore((s) => s.rootName)
  const activeTab = useEditorStore((s) => s.tabs.find((t) => t.path === s.activePath))
  const t = useT()

  return (
    <div className="statusbar">
      <span>{rootName ? `📁 ${rootName}` : t('status.noFolder')}</span>
      {activeTab && <span>{activeTab.dirty ? t('status.unsaved') : t('status.saved')}</span>}
      <div className="spacer" />
      <span>Lumixa</span>
    </div>
  )
}
