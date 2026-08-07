import { useEffect, type JSX } from 'react'
import type { GitFile } from '@shared/ipc'
import { useGitStore } from '@renderer/stores/gitStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useT } from '@renderer/i18n'

/** Source Control panel: status, stage/unstage, AI commit message, push/pull. */
export function GitPanel(): JSX.Element {
  const root = useWorkspaceStore((s) => s.root)
  const {
    status,
    message,
    busy,
    generating,
    lastError,
    setMessage,
    refresh,
    stage,
    unstage,
    stageAll,
    commit,
    push,
    pull,
    generateMessage
  } = useGitStore()
  const t = useT()

  useEffect(() => {
    void refresh()
  }, [refresh, root])

  const name = (p: string): string => p.split(/[\\/]/).pop() ?? p

  if (!root) {
    return (
      <div className="sidebar">
        <div className="sidebar-header">
          <span>{t('git.title')}</span>
        </div>
        <div className="empty-hint">{t('git.noFolder')}</div>
      </div>
    )
  }

  if (status && !status.isRepo) {
    return (
      <div className="sidebar">
        <div className="sidebar-header">
          <span>{t('git.title')}</span>
          <button title={t('git.refresh')} onClick={() => void refresh()}>
            ↻
          </button>
        </div>
        <div className="empty-hint">{t('git.noRepo')}</div>
      </div>
    )
  }

  const files: GitFile[] = status?.files ?? []
  const hasStaged = files.some((f) => f.staged)

  const Row = ({ f }: { f: GitFile }): JSX.Element => (
    <div className="git-row" title={f.path}>
      <span className={`git-code ${f.staged ? 'staged' : ''}`}>
        {f.staged ? f.index : f.work === '?' ? 'U' : f.work}
      </span>
      <span className="git-name">{name(f.path)}</span>
      <span className="spacer" />
      {f.staged ? (
        <button onClick={() => void unstage(f.path)}>−</button>
      ) : (
        <button onClick={() => void stage(f.path)}>+</button>
      )}
    </div>
  )

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>
          {t('git.title')}
          {status?.branch && <span className="git-branch"> ⑂ {status.branch}</span>}
        </span>
        <button title={t('git.refresh')} onClick={() => void refresh()}>
          ↻
        </button>
      </div>

      <div className="git-body">
        <div className="git-commitbox">
          <textarea
            placeholder={t('git.commitPlaceholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="git-commit-actions">
            <button
              className="ai"
              disabled={generating || !hasStaged}
              onClick={() => void generateMessage()}
              title={t('git.aiMessage')}
            >
              {generating ? t('git.generating') : t('git.aiMessage')}
            </button>
            <button
              className="primary"
              disabled={busy || !message.trim() || !hasStaged}
              onClick={() => void commit()}
            >
              {t('git.commit')}
            </button>
          </div>
          <div className="git-remote-actions">
            <button disabled={busy} onClick={() => void pull()}>
              ↓ {t('git.pull')}
              {status && status.behind > 0 ? ` (${status.behind})` : ''}
            </button>
            <button disabled={busy} onClick={() => void push()}>
              ↑ {t('git.push')}
              {status && status.ahead > 0 ? ` (${status.ahead})` : ''}
            </button>
          </div>
          {lastError && <div className="git-error">{lastError}</div>}
        </div>

        {files.length === 0 ? (
          <div className="empty-hint">{t('git.clean')}</div>
        ) : (
          <>
            <div className="git-section">
              <span>{t('git.changes')}</span>
              <button onClick={() => void stageAll()}>{t('git.stageAll')}</button>
            </div>
            <div className="git-list">
              {files.map((f) => (
                <Row key={f.path} f={f} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
