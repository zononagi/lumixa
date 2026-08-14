import { useEffect, useState, type JSX } from 'react'
import type { GitFile } from '@shared/ipc'
import { useGitStore } from '@renderer/stores/gitStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { suggestCommitMessage } from './commitMessage'
import { useT } from '@renderer/i18n'

/** Source Control panel: status, stage/unstage, commit, push/pull, branches. */
export function GitPanel(): JSX.Element {
  const root = useWorkspaceStore((s) => s.root)
  const {
    status,
    branches,
    history,
    message,
    busy,
    lastError,
    setMessage,
    refresh,
    loadHistory,
    stage,
    unstage,
    stageAll,
    commit,
    push,
    pull,
    checkout,
    merge,
    rebase,
    stash,
    stashPop,
    continueOp,
    abortOp
  } = useGitStore()
  const t = useT()
  const [targetBranch, setTargetBranch] = useState('')

  useEffect(() => {
    void refresh()
    void loadHistory()
  }, [refresh, loadHistory, root])

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
  const others = branches.filter((b) => b !== status?.branch)
  const pick = targetBranch || others[0] || ''

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
        {status?.operation && (
          <div className="git-conflict">
            <span>
              {status.operation === 'merge'
                ? t('git.mergeInProgress')
                : t('git.rebaseInProgress')}
            </span>
            <div className="git-remote-actions">
              <button disabled={busy} onClick={() => void continueOp()}>
                {t('git.continue')}
              </button>
              <button disabled={busy} onClick={() => void abortOp()}>
                {t('git.abort')}
              </button>
            </div>
          </div>
        )}

        <div className="git-branchbox">
          <select
            value={pick}
            onChange={(e) => setTargetBranch(e.target.value)}
            disabled={others.length === 0}
          >
            {others.length === 0 && <option value="">{t('git.noOtherBranches')}</option>}
            {others.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <button disabled={busy || !pick} onClick={() => void checkout(pick)}>
            {t('git.checkout')}
          </button>
          <button disabled={busy || !pick} onClick={() => void merge(pick)}>
            {t('git.merge')}
          </button>
          <button disabled={busy || !pick} onClick={() => void rebase(pick)}>
            {t('git.rebase')}
          </button>
        </div>

        <div className="git-commitbox">
          <textarea
            placeholder={t('git.commitPlaceholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="git-commit-actions">
            <button
              disabled={files.length === 0}
              title={t('git.suggestHint')}
              onClick={() => setMessage(suggestCommitMessage(files))}
            >
              {t('git.suggest')}
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
          <div className="git-remote-actions">
            <button disabled={busy} onClick={() => void stash()}>
              {t('git.stash')}
            </button>
            <button disabled={busy} onClick={() => void stashPop()}>
              {t('git.stashPop')}
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

        <div className="git-section">
          <span>{t('git.history')}</span>
          <button onClick={() => void loadHistory()}>{t('git.refresh')}</button>
        </div>
        {history.length === 0 ? (
          <div className="empty-hint">{t('git.historyEmpty')}</div>
        ) : (
          <div className="git-history">
            {history.map((line, i) => (
              <div key={i} className="git-history-row" title={line}>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
