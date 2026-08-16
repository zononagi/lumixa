import { useEffect, type JSX } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useAppearanceStore } from '@renderer/stores/appearanceStore'
import { useAgentStore } from '@renderer/stores/agentStore'
import { setActiveEditor } from '@renderer/lib/editorBridge'
import { useT, useI18nStore } from '@renderer/i18n'
import { languageForFile } from './monacoSetup'

/** Tabbed Monaco editor with Ctrl/Cmd+S save. */
export function EditorArea(): JSX.Element {
  const { tabs, activePath, setActive, closeTab, updateContent, saveActive } = useEditorStore()
  const active = tabs.find((t) => t.path === activePath)
  const monacoTheme = useAppearanceStore((s) => s.monacoTheme)
  const t = useT()

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveActive()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveActive])

  const onMount: OnMount = (editor, monaco) => {
    setActiveEditor(editor, monaco)
    // Right-click → Ask Claude Code. Attaches the current selection (or the
    // whole file when nothing is selected) and opens the Agent panel.
    editor.addAction({
      id: 'lumixa.askClaude',
      label: useI18nStore.getState().locale === 'ja' ? 'Claude Code に質問' : 'Ask Claude Code',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (ed) => {
        const sel = ed.getSelection()
        const hasSel = !!sel && !sel.isEmpty()
        void useAgentStore
          .getState()
          .requestPrefill(hasSel ? 'Explain this code:' : 'Explain this file:', [
            hasSel ? 'selection' : 'file'
          ])
      }
    })
  }

  return (
    <div className="editor-pane">
      <div className="tabs">
        {tabs.map((tab) => (
          <div
            key={tab.path}
            className={`tab ${tab.path === activePath ? 'active' : ''}`}
            onClick={() => setActive(tab.path)}
          >
            <span>{tab.name}</span>
            <button
              className="close"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.path)
              }}
            >
              {tab.dirty ? <span className="dot">●</span> : '×'}
            </button>
          </div>
        ))}
      </div>

      {active ? (
        <div className="editor-host">
          <Editor
            key={active.path}
            height="100%"
            theme={monacoTheme}
            language={languageForFile(active.name)}
            value={active.content}
            onMount={onMount}
            onChange={(value) => updateContent(active.path, value ?? '')}
            options={{
              fontFamily: "'Cascadia Code', 'Consolas', monospace",
              fontSize: 13,
              minimap: { enabled: true },
              smoothScrolling: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              // Ghost Text inline completions (Tab to accept, Esc to dismiss).
              inlineSuggest: { enabled: true },
              suggestSelection: 'first',
              tabCompletion: 'on'
            }}
          />
        </div>
      ) : (
        <div className="editor-empty">
          <div style={{ fontSize: 28 }}>Lumixa</div>
          <div>{t('editor.empty')}</div>
        </div>
      )}
    </div>
  )
}
