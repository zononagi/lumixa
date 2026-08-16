import { useEffect, type JSX } from 'react'
import './features/editor/monacoSetup' // side-effect: configure Monaco loader + workers
import { ActivityBar } from './shell/ActivityBar'
import { StatusBar } from './shell/StatusBar'
import { Explorer } from './features/explorer/Explorer'
import { GitPanel } from './features/git/GitPanel'
import { SettingsPanel } from './features/settings/SettingsPanel'
import { HealthPanel } from './features/project/HealthPanel'
import { ProjectBrainPanel } from './features/brain/ProjectBrainPanel'
import { ArchitectureMapPanel } from './features/architecture/ArchitectureMapPanel'
import { WatcherPanel } from './features/watcher/WatcherPanel'
import { BugDetectivePanel } from './features/bug/BugDetectivePanel'
import { GoalModePanel } from './features/goal/GoalModePanel'
import { AIActivityPanel } from './features/activity/AIActivityPanel'
import { AgentPanel } from './features/agent/AgentPanel'
import { ClaudeCodeDiff } from './features/agent/ClaudeCodeDiff'
import { SelfHealingPanel } from './features/heal/SelfHealingPanel'
import { TestGuardianPanel } from './features/testguardian/TestGuardianPanel'
import { TimeMachinePanel } from './features/timemachine/TimeMachinePanel'
import { SkillMemoryPanel } from './features/memory/SkillMemoryPanel'
import { RiskDetectorPanel } from './features/risk/RiskDetectorPanel'
import { BeginnerAssistantPanel } from './features/beginner/BeginnerAssistantPanel'
import { SafeModePanel } from './features/safe/SafeModePanel'
import { CodeBuilderPanel } from './features/builder/CodeBuilderPanel'
import { EditorArea } from './features/editor/EditorArea'
import { BottomPanel } from './features/terminal/BottomPanel'
import { BackgroundLayer } from './shell/BackgroundLayer'
import { CommandPalette } from './features/palette/CommandPalette'
import { WhyOverlay } from './features/intelligence/WhyOverlay'
import { Toasts } from './shell/Toasts'
import { useAppearanceStore } from './stores/appearanceStore'
import { useUiStore } from './stores/uiStore'

export default function App(): JSX.Element {
  const leftView = useUiStore((s) => s.leftView)
  const setLeftView = useUiStore((s) => s.setLeftView)
  const toggleTerminal = useUiStore((s) => s.toggleTerminal)
  const togglePalette = useUiStore((s) => s.togglePalette)
  const initAppearance = useAppearanceStore((s) => s.init)

  useEffect(() => {
    initAppearance()
  }, [initAppearance])

  // Global shortcuts: Ctrl/Cmd+` terminal, Ctrl/Cmd+Shift+P palette,
  // Ctrl/Cmd+Shift+L toggles the Claude Code (AI Agent) panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault()
        toggleTerminal()
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        togglePalette()
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        setLeftView(useUiStore.getState().leftView === 'agent' ? 'explorer' : 'agent')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleTerminal, togglePalette, setLeftView])

  return (
    <div className="shell">
      <BackgroundLayer />
      <div className="workbench">
        <ActivityBar />
        {leftView === 'explorer' && <Explorer />}
        {leftView === 'git' && <GitPanel />}
        {leftView === 'health' && <HealthPanel />}
        {leftView === 'brain' && <ProjectBrainPanel />}
        {leftView === 'arch' && <ArchitectureMapPanel />}
        {leftView === 'watcher' && <WatcherPanel />}
        {leftView === 'bug' && <BugDetectivePanel />}
        {leftView === 'goal' && <GoalModePanel />}
        {leftView === 'activity' && <AIActivityPanel />}
        {leftView === 'agent' && <AgentPanel />}
        {leftView === 'heal' && <SelfHealingPanel />}
        {leftView === 'tests' && <TestGuardianPanel />}
        {leftView === 'timemachine' && <TimeMachinePanel />}
        {leftView === 'memory' && <SkillMemoryPanel />}
        {leftView === 'risk' && <RiskDetectorPanel />}
        {leftView === 'beginner' && <BeginnerAssistantPanel />}
        {leftView === 'safe' && <SafeModePanel />}
        {leftView === 'builder' && <CodeBuilderPanel />}
        {leftView === 'settings' && <SettingsPanel />}
        <div className="main">
          <EditorArea />
          <BottomPanel />
        </div>
      </div>
      <StatusBar />
      <CommandPalette />
      <WhyOverlay />
      <ClaudeCodeDiff />
      <Toasts />
    </div>
  )
}
