import { useEffect, useState, type JSX } from 'react'
import './features/editor/monacoSetup' // side-effect: configure Monaco loader + workers
import { ActivityBar, type LeftView } from './shell/ActivityBar'
import { StatusBar } from './shell/StatusBar'
import { Explorer } from './features/explorer/Explorer'
import { GitPanel } from './features/git/GitPanel'
import { SettingsPanel } from './features/settings/SettingsPanel'
import { EditorArea } from './features/editor/EditorArea'
import { BottomPanel } from './features/terminal/BottomPanel'
import { BackgroundLayer } from './shell/BackgroundLayer'
import { useAppearanceStore } from './stores/appearanceStore'
import { useUiStore } from './stores/uiStore'

export default function App(): JSX.Element {
  const [leftView, setLeftView] = useState<LeftView>('explorer')

  const initAppearance = useAppearanceStore((s) => s.init)
  const toggleTerminal = useUiStore((s) => s.toggleTerminal)

  useEffect(() => {
    initAppearance()
  }, [initAppearance])

  // Global shortcut: Ctrl/Cmd+` toggles the terminal panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault()
        toggleTerminal()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleTerminal])

  return (
    <div className="shell">
      <BackgroundLayer />
      <div className="workbench">
        <ActivityBar active={leftView} onSelect={setLeftView} />
        {leftView === 'explorer' && <Explorer />}
        {leftView === 'git' && <GitPanel />}
        {leftView === 'settings' && <SettingsPanel />}
        <div className="main">
          <EditorArea />
          <BottomPanel />
        </div>
      </div>
      <StatusBar />
    </div>
  )
}
