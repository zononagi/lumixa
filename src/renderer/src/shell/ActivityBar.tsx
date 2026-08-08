import type { JSX } from 'react'
import { useUiStore } from '@renderer/stores/uiStore'
import { useT } from '@renderer/i18n'

export type LeftView = 'explorer' | 'git' | 'settings'

interface Props {
  active: LeftView
  onSelect: (view: LeftView) => void
}

/** Far-left icon rail. Switches the left panel and toggles the terminal. */
export function ActivityBar({ active, onSelect }: Props): JSX.Element {
  const { terminalOpen, toggleTerminal } = useUiStore()
  const t = useT()
  return (
    <div className="activitybar">
      <button
        className={active === 'explorer' ? 'active' : ''}
        title={t('ab.explorer')}
        onClick={() => onSelect('explorer')}
      >
        🗂
      </button>
      <button
        className={active === 'git' ? 'active' : ''}
        title={t('ab.git')}
        onClick={() => onSelect('git')}
      >
        ⑂
      </button>
      <button
        className={active === 'settings' ? 'active' : ''}
        title={t('ab.settings')}
        onClick={() => onSelect('settings')}
      >
        ⚙
      </button>
      <button
        className={terminalOpen ? 'active' : ''}
        title={t('ab.terminal')}
        onClick={toggleTerminal}
      >
        ▣
      </button>
      <div style={{ flex: 1 }} />
    </div>
  )
}
