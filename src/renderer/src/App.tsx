import { useEffect, type JSX } from 'react'
import './features/editor/monacoSetup' // side-effect: configure Monaco loader + workers
import { ActivityBar } from './shell/ActivityBar'
import { StatusBar } from './shell/StatusBar'
import { Explorer } from './features/explorer/Explorer'
import { GitPanel } from './features/git/GitPanel'
import { SettingsPanel } from './features/settings/SettingsPanel'
import { HealthPanel } from './features/project/HealthPanel'
import { EditorArea } from './features/editor/EditorArea'
import { BottomPanel } from './features/terminal/BottomPanel'
import { BackgroundLayer } from './shell/BackgroundLayer'
import { CommandPalette } from './features/palette/CommandPalette'
import { WhyOverlay } from './features/intelligence/WhyOverlay'
import { useAppearanceStore } from './stores/appearanceStore'
import { useUiStore } from './stores/uiStore'

export default function App(): JSX.Element {
  const leftView = useUiStore((s) => s.leftView)
  const toggleTerminal = useUiStore((s) => s.toggleTerminal)
  const togglePalette = useUiStore((s) => s.togglePalette)
  const initAppearance = useAppearanceStore((s) => s.init)

  useEffect(() => {
    initAppearance()
  }, [initAppearance])

  // Global shortcuts: Ctrl/Cmd+` terminal, Ctrl/Cmd+Shift+P command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault()
        toggleTerminal()
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        togglePalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleTerminal, togglePalette])

  return (
    <div className="shell">
      <BackgroundLayer />
      <div className="workbench">
        <ActivityBar />
        {leftView === 'explorer' && <Explorer />}
        {leftView === 'git' && <GitPanel />}
        {leftView === 'health' && <HealthPanel />}
        {leftView === 'settings' && <SettingsPanel />}
        <div className="main">
          <EditorArea />
          <BottomPanel />
        </div>
      </div>
      <StatusBar />
      <CommandPalette />
      <WhyOverlay />
    </div>
  )
}
