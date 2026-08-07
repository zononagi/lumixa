import { useState, type JSX } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { useUiStore } from '@renderer/stores/uiStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { complete } from '@renderer/lib/ai'
import { languageForFile } from '@renderer/features/editor/monacoSetup'
import { COMPOSER_SYSTEM, buildContext, parseEdits, type ProposedEdit } from './edits'

interface ReviewItem extends ProposedEdit {
  name: string
  original: string
  status: 'pending' | 'accepted' | 'rejected' | 'applied'
}

/**
 * Composer: describe a change, the model proposes whole-file edits, review each
 * as a diff, then Accept/Reject. Nothing touches disk until you apply — the
 * foundation for Ghost Mode.
 */
export function Composer(): JSX.Element | null {
  const open = useUiStore((s) => s.composerOpen)
  const setComposer = useUiStore((s) => s.setComposer)
  const tabs = useEditorStore((s) => s.tabs)
  const setSavedContent = useEditorStore((s) => s.setSavedContent)
  const hasModel = useSettingsStore((s) => s.models.length > 0)

  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ReviewItem[]>([])

  if (!open) return null

  const generate = async (): Promise<void> => {
    if (!instruction.trim() || busy) return
    setBusy(true)
    setError(null)
    setItems([])
    const res = await complete(COMPOSER_SYSTEM, buildContext(instruction, tabs))
    if (res.error) {
      setError(res.error)
      setBusy(false)
      return
    }
    const edits = parseEdits(res.text)
    if (edits.length === 0) {
      setError('The model returned no file edits. Try rephrasing the instruction.')
      setBusy(false)
      return
    }
    const reviews: ReviewItem[] = await Promise.all(
      edits.map(async (e) => {
        const openTab = tabs.find((t) => t.path === e.path)
        let original = openTab?.content ?? ''
        if (!openTab) {
          try {
            original = await window.lumixa.fs.readFile(e.path)
          } catch {
            original = '' // new file
          }
        }
        return {
          ...e,
          name: e.path.split(/[\\/]/).pop() ?? e.path,
          original,
          status: 'pending' as const
        }
      })
    )
    setItems(reviews)
    setBusy(false)
  }

  const setStatus = (path: string, status: ReviewItem['status']): void =>
    setItems((prev) => prev.map((it) => (it.path === path ? { ...it, status } : it)))

  const applyAccepted = async (): Promise<void> => {
    for (const it of items) {
      if (it.status !== 'accepted') continue
      await window.lumixa.fs.writeFile(it.path, it.newContent)
      setSavedContent(it.path, it.newContent)
      setStatus(it.path, 'applied')
    }
  }

  const acceptedCount = items.filter((i) => i.status === 'accepted').length

  return (
    <div className="modal-backdrop" onClick={() => setComposer(false)}>
      <div className="composer" onClick={(e) => e.stopPropagation()}>
        <div className="composer-header">
          <span>✦ Composer</span>
          <button onClick={() => setComposer(false)}>✕</button>
        </div>

        <div className="composer-prompt">
          <textarea
            placeholder={
              hasModel
                ? 'Describe the change across your open files… (e.g. "add a dark-mode toggle to the header")'
                : 'Configure a provider in Settings first.'
            }
            value={instruction}
            disabled={!hasModel || busy}
            onChange={(e) => setInstruction(e.target.value)}
          />
          <div className="composer-actions">
            <span className="ctx">{tabs.length} file(s) in context</span>
            <button
              className="primary"
              disabled={!hasModel || busy || !instruction.trim()}
              onClick={() => void generate()}
            >
              {busy ? 'Generating…' : 'Generate edits'}
            </button>
          </div>
          {error && <div className="composer-error">⚠️ {error}</div>}
        </div>

        <div className="composer-review">
          {items.map((it) => (
            <div key={it.path} className={`review-item ${it.status}`}>
              <div className="review-head">
                <span className="path">
                  {it.original === '' ? '🆕 ' : ''}
                  {it.path}
                </span>
                <span className="spacer" />
                {it.status === 'applied' ? (
                  <span className="applied-badge">✓ Applied</span>
                ) : (
                  <>
                    <button
                      className={it.status === 'accepted' ? 'on' : ''}
                      onClick={() => setStatus(it.path, 'accepted')}
                    >
                      Accept
                    </button>
                    <button
                      className={it.status === 'rejected' ? 'on danger' : ''}
                      onClick={() => setStatus(it.path, 'rejected')}
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
              {it.status !== 'rejected' && (
                <div className="review-diff">
                  <DiffEditor
                    height="240px"
                    theme="vs-dark"
                    language={languageForFile(it.name)}
                    original={it.original}
                    modified={it.newContent}
                    options={{
                      readOnly: true,
                      renderSideBySide: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div className="composer-footer">
            <button
              className="primary"
              disabled={acceptedCount === 0}
              onClick={() => void applyAccepted()}
            >
              Apply {acceptedCount} accepted change(s)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
