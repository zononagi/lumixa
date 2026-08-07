import { useEffect, type JSX } from 'react'
import Editor from '@monaco-editor/react'
import { useEditorStore } from '@renderer/stores/editorStore'
import { languageForFile } from './monacoSetup'

/** Tabbed Monaco editor. Ctrl/Cmd+S saves the active buffer to disk. */
export function EditorArea(): JSX.Element {
  const { tabs, activePath, setActive, closeTab, updateContent, saveActive } =
    useEditorStore()
  const active = tabs.find((t) => t.path === activePath)

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

  return (
    <div className="main">
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
            theme="vs-dark"
            language={languageForFile(active.name)}
            value={active.content}
            onChange={(value) => updateContent(active.path, value ?? '')}
            options={{
              fontFamily: "'Cascadia Code', 'Consolas', monospace",
              fontSize: 13,
              minimap: { enabled: true },
              smoothScrolling: true,
              scrollBeyondLastLine: false,
              automaticLayout: true
            }}
          />
        </div>
      ) : (
        <div className="editor-empty">
          <div style={{ fontSize: 28 }}>✨ Lumixa</div>
          <div>Open a file from the Explorer, or ask the AI panel to get started.</div>
        </div>
      )}
    </div>
  )
}
