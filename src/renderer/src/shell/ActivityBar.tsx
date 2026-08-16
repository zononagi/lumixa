import type { JSX } from 'react'
import { useUiStore } from '@renderer/stores/uiStore'
import { useT } from '@renderer/i18n'

/** Far-left icon rail. Switches the left panel and toggles the terminal/palette. */
export function ActivityBar(): JSX.Element {
  const { leftView, setLeftView, terminalOpen, toggleTerminal, togglePalette } = useUiStore()
  const t = useT()

  const view = (id: Parameters<typeof setLeftView>[0], icon: string, title: string): JSX.Element => (
    <button className={leftView === id ? 'active' : ''} title={title} onClick={() => setLeftView(id)}>
      {icon}
    </button>
  )

  return (
    <div className="activitybar">
      {view('explorer', '🗂', t('ab.explorer'))}
      {view('git', '⑂', t('ab.git'))}
      {view('health', '📊', t('ab.health'))}
      {view('brain', '🧠', t('ab.brain'))}
      {view('arch', '🗺', t('ab.arch'))}
      {view('watcher', '👁', t('ab.watcher'))}
      {view('bug', '🐞', t('ab.bug'))}
      {view('goal', '🎯', t('ab.goal'))}
      {view('agent', '✦', t('ab.agent'))}
      {view('heal', '🩺', t('ab.heal'))}
      {view('tests', '🧪', t('ab.tests'))}
      {view('timemachine', '⌛', t('ab.timemachine'))}
      {view('memory', '📓', t('ab.memory'))}
      {view('risk', '⚠', t('ab.risk'))}
      {view('builder', '🧩', t('ab.builder'))}
      {view('safe', '🛟', t('ab.safe'))}
      {view('settings', '⚙', t('ab.settings'))}
      <button className={terminalOpen ? 'active' : ''} title={t('ab.terminal')} onClick={toggleTerminal}>
        ▣
      </button>
      <div style={{ flex: 1 }} />
      <button title={t('ab.palette')} onClick={togglePalette}>
        ⌘
      </button>
    </div>
  )
}
