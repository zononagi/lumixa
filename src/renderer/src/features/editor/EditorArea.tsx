import { useEffect, useRef, useState, type JSX } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { useEditorStore } from '@renderer/stores/editorStore'
import { complete } from '@renderer/lib/ai'
import { useT } from '@renderer/i18n'
import { languageForFile } from './monacoSetup'

const INLINE_SYSTEM = `You are Lumixa's inline code editor. The user selected a code snippet and gives an instruction.
Return ONLY the replacement code for that selection — raw code, no markdown fences, no explanation, no commentary. Preserve indentation style.`

/** Strip accidental ```lang fences the model may wrap around the snippet. */
function stripFences(text: string): string {
  const t = text.trim()
  if (t.startsWith('```')) {
    return t
      .replace(/^```[a-zA-Z0-9]*\r?\n/, '')
      .replace(/\r?\n```$/, '')
  }
  return text
}

/** Tabbed Monaco editor with Ctrl/Cmd+S save and Ctrl/Cmd+K inline AI edit. */
export function EditorArea(): JSX.Element {
  const { tabs, activePath, setActive, closeTab, updateContent, saveActive } =
    useEditorStore()
  const active = tabs.find((t) => t.path === activePath)
  const t = useT()

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const [inlineOpen, setInlineOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [applied, setApplied] = useState(false)

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
    editorRef.current = editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      setApplied(false)
      setPrompt('')
      setInlineOpen(true)
    })
  }

  const runInline = async (): Promise<void> => {
    const editor = editorRef.current
    if (!editor || !active || !prompt.trim()) return
    const model = editor.getModel()
    if (!model) return
    const current = editor.getSelection()
    if (!current || current.isEmpty()) {
      // No selection → operate on the current line.
      const line = editor.getPosition()?.lineNumber ?? 1
      editor.setSelection({
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: model.getLineMaxColumn(line)
      })
    }
    const sel = editor.getSelection()!
    const selected = model.getValueInRange(sel)
    setBusy(true)
    const res = await complete(
      INLINE_SYSTEM,
      `Language: ${languageForFile(active.name)}\nInstruction: ${prompt}\n\nSelection:\n${selected}`
    )
    setBusy(false)
    if (res.error) {
      setPrompt(`⚠️ ${res.error}`)
      return
    }
    const replacement = stripFences(res.text)
    editor.executeEdits('lumixa-inline', [{ range: sel, text: replacement }])
    editor.focus()
    setInlineOpen(false)
    setApplied(true)
  }

  const undoInline = (): void => {
    editorRef.current?.trigger('lumixa', 'undo', null)
    setApplied(false)
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
          {(inlineOpen || applied) && (
            <div className="inline-edit">
              {inlineOpen ? (
                <>
                  <span className="badge">Ctrl+K</span>
                  <input
                    autoFocus
                    placeholder={t('editor.inlinePlaceholder')}
                    value={prompt}
                    disabled={busy}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void runInline()
                      if (e.key === 'Escape') setInlineOpen(false)
                    }}
                  />
                  <button disabled={busy || !prompt.trim()} onClick={() => void runInline()}>
                    {busy ? '…' : t('editor.inlineEdit')}
                  </button>
                  <button onClick={() => setInlineOpen(false)}>Esc</button>
                </>
              ) : (
                <>
                  <span className="badge ok">{t('editor.applied')}</span>
                  <button onClick={() => setApplied(false)}>{t('editor.keep')}</button>
                  <button className="danger" onClick={undoInline}>
                    {t('editor.undo')}
                  </button>
                </>
              )}
            </div>
          )}
          <Editor
            key={active.path}
            height="100%"
            theme="vs-dark"
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
              automaticLayout: true
            }}
          />
        </div>
      ) : (
        <div className="editor-empty">
          <div style={{ fontSize: 28 }}>✨ Lumixa</div>
          <div>{t('editor.empty')}</div>
        </div>
      )}
    </div>
  )
}
