import { useEffect, useState, type JSX } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { useAgentStore } from '@renderer/stores/agentStore'
import { useAppearanceStore } from '@renderer/stores/appearanceStore'
import { languageForFile } from '@renderer/features/editor/monacoSetup'
import { useT } from '@renderer/i18n'

/**
 * Modal diff viewer for a file Claude Code changed (spec §8). Shows the captured
 * pre-edit content (left) against what is on disk now (right) in a Monaco diff
 * editor. "Keep" accepts the change (it is already applied on disk); "Revert"
 * writes the pre-edit content back. Best-effort: if Lumixa could not capture the
 * "before" (e.g. the edit had already run), the left side is empty.
 */
export function ClaudeCodeDiff(): JSX.Element | null {
  const t = useT()
  const target = useAgentStore((s) => s.diffTarget)
  const beforeByKey = useAgentStore((s) => s.beforeByKey)
  const closeDiff = useAgentStore((s) => s.closeDiff)
  const rejectDiff = useAgentStore((s) => s.rejectDiff)
  const monacoTheme = useAppearanceStore((s) => s.monacoTheme)
  const [after, setAfter] = useState<string | null>(null)

  const path = target?.path ?? null
  const name = path ? (path.split(/[\\/]/).pop() ?? path) : ''
  const before = target ? (beforeByKey[`${target.sessionId}::${target.path}`] ?? '') : ''

  useEffect(() => {
    let cancelled = false
    if (!path) {
      setAfter(null)
      return
    }
    setAfter(null)
    void window.lumixa.fs
      .readFile(path)
      .then((c) => {
        if (!cancelled) setAfter(c)
      })
      .catch(() => {
        if (!cancelled) setAfter('')
      })
    return () => {
      cancelled = true
    }
  }, [path])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && target) closeDiff()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [target, closeDiff])

  if (!target) return null

  return (
    <div className="diff-overlay" onClick={closeDiff}>
      <div className="diff-modal" onClick={(e) => e.stopPropagation()}>
        <div className="diff-head">
          <span className="diff-title">{name}</span>
          <span className="diff-path">{path}</span>
          <div className="diff-actions">
            <button className="diff-revert" onClick={() => void rejectDiff()}>
              {t('diff.revert')}
            </button>
            <button className="diff-keep" onClick={closeDiff}>
              {t('diff.keep')}
            </button>
          </div>
        </div>
        <div className="diff-body">
          {after === null ? (
            <div className="diff-loading">{t('diff.loading')}</div>
          ) : (
            <DiffEditor
              height="100%"
              theme={monacoTheme}
              language={languageForFile(name)}
              original={before}
              modified={after}
              options={{
                readOnly: true,
                renderSideBySide: true,
                automaticLayout: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 12
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
