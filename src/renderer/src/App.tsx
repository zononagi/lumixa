import { useEffect, useState, type JSX } from 'react'
import './features/editor/monacoSetup' // side-effect: configure Monaco loader + workers
import { ActivityBar, type LeftView } from './shell/ActivityBar'
import { StatusBar } from './shell/StatusBar'
import { Explorer } from './features/explorer/Explorer'
import { SettingsPanel } from './features/settings/SettingsPanel'
import { EditorArea } from './features/editor/EditorArea'
import { ChatPanel } from './features/chat/ChatPanel'
import { useChatStore } from './stores/chatStore'
import { useSettingsStore } from './stores/settingsStore'

export default function App(): JSX.Element {
  const [leftView, setLeftView] = useState<LeftView>('explorer')
  const [chatOpen, setChatOpen] = useState(true)

  const initChat = useChatStore((s) => s.init)
  const refreshModels = useSettingsStore((s) => s.refreshModels)
  const refreshConfigured = useSettingsStore((s) => s.refreshConfigured)

  useEffect(() => {
    const dispose = initChat()
    void refreshConfigured().then(() => refreshModels())
    return dispose
  }, [initChat, refreshModels, refreshConfigured])

  return (
    <div className="shell">
      <div className="workbench">
        <ActivityBar
          active={leftView}
          onSelect={setLeftView}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen((v) => !v)}
        />
        {leftView === 'explorer' ? <Explorer /> : <SettingsPanel />}
        <EditorArea />
        {chatOpen && <ChatPanel />}
      </div>
      <StatusBar />
    </div>
  )
}
