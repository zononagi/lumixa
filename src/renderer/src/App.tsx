import { useEffect, useState, type JSX } from 'react'
import './features/editor/monacoSetup' // side-effect: configure Monaco loader + workers
import { ActivityBar, type LeftView } from './shell/ActivityBar'
import { StatusBar } from './shell/StatusBar'
import { Explorer } from './features/explorer/Explorer'
import { GitPanel } from './features/git/GitPanel'
import { SettingsPanel } from './features/settings/SettingsPanel'
import { EditorArea } from './features/editor/EditorArea'
import { ChatPanel } from './features/chat/ChatPanel'
import { BottomPanel } from './features/terminal/BottomPanel'
import { Composer } from './features/composer/Composer'
import { useChatStore } from './stores/chatStore'
import { useSettingsStore } from './stores/settingsStore'
import { useUiStore } from './stores/uiStore'

export default function App(): JSX.Element {
  const [leftView, setLeftView] = useState<LeftView>('explorer')
  const [chatOpen, setChatOpen] = useState(true)

  const initChat = useChatStore((s) => s.init)
  const refreshModels = useSettingsStore((s) => s.refreshModels)
  const refreshConfigured = useSettingsStore((s) => s.refreshConfigured)
  const toggleTerminal = useUiStore((s) => s.toggleTerminal)

  useEffect(() => {
    const dispose = initChat()
    void refreshConfigured().then(() => refreshModels())
    return dispose
  }, [initChat, refreshModels, refreshConfigured])

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
      <div className="workbench">
        <ActivityBar
          active={leftView}
          onSelect={setLeftView}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen((v) => !v)}
        />
        {leftView === 'explorer' && <Explorer />}
        {leftView === 'git' && <GitPanel />}
        {leftView === 'settings' && <SettingsPanel />}
        <div className="main">
          <EditorArea />
          <BottomPanel />
        </div>
        {chatOpen && <ChatPanel />}
      </div>
      <StatusBar />
      <Composer />
    </div>
  )
}
