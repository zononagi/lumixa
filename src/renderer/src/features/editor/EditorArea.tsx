import { useEffect, useRef, useState, type JSX } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditor, IRange } from 'monaco-editor'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useAppearanceStore } from '@renderer/stores/appearanceStore'
import { complete } from '@renderer/lib/ai'
import { useT } from '@renderer/i18n'
import { languageForFile } from './monacoSetup'
import { lineDiff, type DiffLine } from './diff'

const INLINE_SYSTEM = `You are Lumixa's inline code editor. The user selected a code snippet and gives an instruction.
Return ONLY the replacement code for that selection — raw code, no markdown fences, no explanation, no commentary. Preserve indentation style.`

const FIX_SYSTEM = `You are Lumixa's one-click fixer. You are given a code region and the compiler/linter errors it produces.
Return ONLY the corrected code for that region — raw code, no markdown fences, no explanation. Preserve indentation and surrounding style; change as little as possible to resolve the errors.`

/** Strip accidental ```lang fences the model may wrap around the snippet. */
function stripFences(text: string): string {
  const t = text.trim()
  if (t.startsWith('```')) {
    return t.replace(/^```[a-zA-Z0-9]*\r?\n/, '').replace(/\r?\n```$/, '')
  }
  return text
}

interface Pending {
  range: IRange
  replacement: string
  diff: DiffLine[]
}

/** Tabbed Monaco editor with Ctrl/Cmd+S save, Ctrl+K inline AI edit (with diff
 *  preview + ghost highlight) and one-click Fix for diagnostics. */
export function EditorArea(): JSX.Element {
  const { tabs, activePath, setActive, closeTab, updateContent, saveActive } = useEditorStore()
  const active = tabs.find((t) => t.path === activePath)
  const monacoTheme = useAppearanceStore((s) => s.monacoTheme)
  const t = useT()

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null)
  const ghostRef = useRef<MonacoEditor.IEditorDecorationsCollection | null>(null)

  const [inlineOpen, setInlineOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [markerCount, setMarkerCount] = useState(0)

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

  const clearGhost = (): void => {
    ghostRef.current?.clear()
    ghostRef.current = null
  }

  const highlightRange = (range: IRange): void => {
    const monaco = monacoRef.current
    const editor = editorRef.current
    if (!monaco || !editor) return
    clearGhost()
    ghostRef.current = editor.createDecorationsCollection([
      { range: new monaco.Range(range.startLineNumber, 1, range.endLineNumber, 1), options: { isWholeLine: true, className: 'lumixa-ghost-range', linesDecorationsClassName: 'lumixa-ghost-gutter' } }
    ])
  }

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      setPending(null)
      clearGhost()
      setPrompt('')
      setInlineOpen(true)
    })

    // One-click Fix: keybinding + right-click menu action.
    editor.addAction({
      id: 'lumixa.fix',
      label: '✨ Fix with Lumixa',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Period],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 0,
      run: () => void runFix()
    })

    const refreshMarkers = (): void => {
      const model = editor.getModel()
      if (!model) return setMarkerCount(0)
      setMarkerCount(monaco.editor.getModelMarkers({ resource: model.uri }).filter((m) => m.severity >= 8).length)
    }
    monaco.editor.onDidChangeMarkers(refreshMarkers)
    refreshMarkers()
  }

  /** Resolve the working selection (falls back to the current line). */
  const workingSelection = (): { range: IRange; text: string } | null => {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model) return null
    let sel = editor.getSelection()
    if (!sel || sel.isEmpty()) {
      const line = editor.getPosition()?.lineNumber ?? 1
      sel = new (monacoRef.current!.Selection)(line, 1, line, model.getLineMaxColumn(line))
    }
    return { range: sel, text: model.getValueInRange(sel) }
  }

  const preview = (range: IRange, original: string, replacement: string): void => {
    setPending({ range, replacement, diff: lineDiff(original, replacement) })
    highlightRange(range)
    setInlineOpen(false)
  }

  const runInline = async (): Promise<void> => {
    const sel = workingSelection()
    if (!sel || !active || !prompt.trim()) return
    setBusy(true)
    const res = await complete(
      INLINE_SYSTEM,
      `Language: ${languageForFile(active.name)}\nInstruction: ${prompt}\n\nSelection:\n${sel.text}`
    )
    setBusy(false)
    if (res.error) {
      setPrompt(`⚠️ ${res.error}`)
      return
    }
    preview(sel.range, sel.text, stripFences(res.text))
  }

  const runFix = async (): Promise<void> => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    const model = editor?.getModel()
    if (!editor || !monaco || !model || !active) return
    const sel = workingSelection()
    if (!sel) return

    const markers = monaco.editor
      .getModelMarkers({ resource: model.uri })
      .filter(
        (m) => m.startLineNumber <= sel.range.endLineNumber && m.endLineNumber >= sel.range.startLineNumber
      )
    const errs = markers.length
      ? markers.map((m) => `- L${m.startLineNumber}: ${m.message}`).join('\n')
      : '(no diagnostics reported; infer the likely problem)'

    setInlineOpen(false)
    setBusy(true)
    const res = await complete(
      FIX_SYSTEM,
      `Language: ${languageForFile(active.name)}\nErrors:\n${errs}\n\nCode:\n${sel.text}`
    )
    setBusy(false)
    if (res.error) return
    preview(sel.range, sel.text, stripFences(res.text))
  }

  const accept = (): void => {
    const editor = editorRef.current
    if (editor && pending) {
      editor.executeEdits('lumixa-inline', [{ range: pending.range, text: pending.replacement }])
      editor.focus()
    }
    clearGhost()
    setPending(null)
  }

  const reject = (): void => {
    clearGhost()
    setPending(null)
    editorRef.current?.focus()
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
        <span className="spacer" />
        {active && markerCount > 0 && !pending && (
          <button className="fix-btn" disabled={busy} onClick={() => void runFix()}>
            {busy ? '…' : t('editor.fixProblems', { n: markerCount })}
          </button>
        )}
      </div>

      {active ? (
        <div className="editor-host">
          {inlineOpen && (
            <div className="inline-edit">
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
            </div>
          )}

          {pending && (
            <div className="ai-diff">
              <div className="ai-diff-head">
                <span className="badge">{t('editor.diffPreview')}</span>
                <span className="spacer" />
                <button className="ok" onClick={accept}>
                  {t('editor.accept')}
                </button>
                <button className="danger" onClick={reject}>
                  {t('editor.reject')}
                </button>
              </div>
              <pre className="ai-diff-body">
                {pending.diff.map((l, i) => (
                  <div key={i} className={`dl ${l.type}`}>
                    <span className="sign">{l.type === 'add' ? '+' : l.type === 'del' ? '−' : ' '}</span>
                    {l.text || ' '}
                  </div>
                ))}
              </pre>
            </div>
          )}

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
