import { type JSX } from 'react'
import { useTimeMachineStore } from '@renderer/stores/timeMachineStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useAgentStore } from '@renderer/stores/agentStore'
import { useT } from '@renderer/i18n'
import { extractRefs } from './timeMachine'

/**
 * Git Time Machine panel (spec §25-§26). Inspect the git origin of the line at
 * the cursor — who introduced it, in which commit, referenced PRs/issues, and a
 * file history — then ask Claude Code why it exists and whether it's safe to
 * change. Facts are real git output; the reasoning is clearly AI.
 */
export function TimeMachinePanel(): JSX.Element {
  const t = useT()
  const root = useWorkspaceStore((s) => s.root)
  const activePath = useEditorStore((s) => s.activePath)
  const { file, line, blame, commit, history, loading, error, inspect, explain } =
    useTimeMachineStore()
  const claudeReady = useAgentStore((s) =>
    s.providers.some((p) => p.id === 'claude-code' && p.state === 'authenticated')
  )

  if (!root) {
    return (
      <div className="sidebar timemachine">
        <div className="sidebar-header">
          <span>{t('tm.title')}</span>
        </div>
        <div className="empty-hint">{t('tm.noWorkspace')}</div>
      </div>
    )
  }

  const refs = commit ? extractRefs(`${commit.subject}\n${commit.body}`) : []

  return (
    <div className="sidebar timemachine">
      <div className="sidebar-header">
        <span>{t('tm.title')}</span>
      </div>

      <div className="tm-body">
        <div className="tm-intro">{t('tm.intro')}</div>

        <button
          className="tm-inspect"
          disabled={!activePath || loading}
          onClick={() => void inspect()}
        >
          {loading ? t('tm.inspecting') : t('tm.inspect')}
        </button>
        {!activePath && <div className="tm-hint">{t('tm.openFile')}</div>}

        {error && <div className="tm-error">{error}</div>}

        {blame && (
          <div className="tm-result">
            <div className="tm-line-ref">
              {file?.split(/[\\/]/).pop()}:{line}
            </div>

            <div className="tm-section-title">{t('tm.introduced')}</div>
            <div className="tm-commit">
              <span className="tm-hash">{blame.shortHash}</span>
              <span className="tm-when">
                {blame.author} · {blame.date}
              </span>
            </div>
            <div className="tm-subject">{commit?.subject ?? blame.summary}</div>
            {commit?.body && <div className="tm-commit-body">{commit.body}</div>}

            {refs.length > 0 && (
              <div className="tm-refs">
                {t('tm.refs')}: {refs.map((n) => `#${n}`).join(', ')}
              </div>
            )}

            {claudeReady && (
              <button className="tm-explain" onClick={() => void explain()}>
                {t('tm.explain')}
              </button>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="tm-history">
            <div className="tm-section-title">{t('tm.history')}</div>
            {history.map((h, i) => (
              <div key={i} className="tm-hist-row">
                {h}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
