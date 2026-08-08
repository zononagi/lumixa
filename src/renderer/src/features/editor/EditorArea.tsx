import { useEffect, type JSX } from 'react'
import Editor from '@monaco-editor/react'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useAppearanceStore } from '@renderer/stores/appearanceStore'
import { useT } from '@renderer/i18n'
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
