import type { JSX } from 'react'

export type LeftView = 'explorer' | 'settings'

interface Props {
  active: LeftView
  onSelect: (view: LeftView) => void
  chatOpen: boolean
  onToggleChat: () => void
}

/** Far-left icon rail. Switches the left panel and toggles the AI chat panel. */
export function ActivityBar({ active, onSelect, chatOpen, onToggleChat }: Props): JSX.Element {
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
      <div style={{ flex: 1 }} />
      <button
        className={chatOpen ? 'active' : ''}
        title="AI Chat"
        onClick={onToggleChat}
      >
        ✨
      </button>
    </div>
  )
}
