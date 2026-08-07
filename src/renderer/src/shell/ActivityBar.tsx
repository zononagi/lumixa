import type { JSX } from 'react'
import { useUiStore } from '@renderer/stores/uiStore'

export type LeftView = 'explorer' | 'settings'

interface Props {
  active: LeftView
  onSelect: (view: LeftView) => void
  chatOpen: boolean
  onToggleChat: () => void
}

/** Far-left icon rail. Switches the left panel and toggles feature panels. */
export function ActivityBar({ active, onSelect, chatOpen, onToggleChat }: Props): JSX.Element {
  const { composerOpen, toggleComposer, terminalOpen, toggleTerminal } = useUiStore()
  return (
    <div className="activitybar">
      <button
        className={active === 'explorer' ? 'active' : ''}
        title="Explorer"
        onClick={() => onSelect('explorer')}
      >
        🗂
      </button>
      <button
        className={active === 'settings' ? 'active' : ''}
        title="Settings"
        onClick={() => onSelect('settings')}
      >
        ⚙
      </button>
      <button
        className={composerOpen ? 'active' : ''}
        title="Composer — multi-file AI edits"
        onClick={toggleComposer}
      >
        ✦
      </button>
      <button
        className={terminalOpen ? 'active' : ''}
        title="Terminal (Ctrl+`)"
        onClick={toggleTerminal}
      >
        ▣
      </button>
      <div style={{ flex: 1 }} />
      <button className={chatOpen ? 'active' : ''} title="AI Chat" onClick={onToggleChat}>
        ✨
      </button>
    </div>
  )
}
