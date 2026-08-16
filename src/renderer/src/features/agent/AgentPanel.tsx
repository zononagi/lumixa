import { useEffect, useRef, useState, type JSX } from 'react'
import type { PermissionMode, ProviderStatus } from '@shared/agent'
import { useAgentStore, type ChatItem, type SessionView } from '@renderer/stores/agentStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useUiStore } from '@renderer/stores/uiStore'
import {
  CONTEXT_META,
  contextAvailability,
  type ContextKind
} from './agentContext'
import { QUICK_ACTIONS } from './quickActions'
import { UsagePanel } from './UsagePanel'
import { Markdown, CopyButton } from './Markdown'
import { useT, type TKey } from '@renderer/i18n'

const CONTEXT_ORDER: ContextKind[] = ['file', 'selection', 'workspace', 'problems', 'gitDiff']
const CONTEXT_LABEL: Record<ContextKind, TKey> = {
  file: 'ctx.file',
  selection: 'ctx.selection',
  workspace: 'ctx.workspace',
  problems: 'ctx.problems',
  gitDiff: 'ctx.gitDiff'
}
const PERMISSION_MODES: PermissionMode[] = ['default', 'acceptEdits', 'plan', 'bypassPermissions']
const PERMISSION_LABEL: Record<PermissionMode, TKey> = {
  default: 'perm.default',
  acceptEdits: 'perm.acceptEdits',
  plan: 'perm.plan',
  bypassPermissions: 'perm.bypass'
}

/**
 * AI Agent panel. Drives the user's local Claude Code CLI through the generic
 * agent runtime and renders its streaming output (messages, tool calls, file
 * changes) in real time. Adds beginner-friendly context wiring — Quick Actions,
 * a "+ Context" attacher, and @mentions — so nobody has to touch a terminal.
 */
export function AgentPanel(): JSX.Element {
  const t = useT()
  const {
    providers,
    sessionsById,
    order,
    activeId,
    permissionMode,
    setPermissionMode,
    init,
    refreshProviders,
    createSession,
    setActive,
    rename,
    closeSession
  } = useAgentStore()
  const root = useWorkspaceStore((s) => s.root)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    init()
  }, [init])

  const claude = providers.find((p) => p.id === 'claude-code')
  const active = activeId ? sessionsById[activeId] : null

  return (
    <div className="sidebar agent">
      <div className="sidebar-header">
        <span>{t('agent.title')}</span>
        <div className="agent-header-btns">
          <button title={t('agent.settings')} onClick={() => setShowSettings((v) => !v)}>
            ⚙
          </button>
          <button title={t('agent.refresh')} onClick={() => void refreshProviders()}>
            ↻
          </button>
        </div>
      </div>

      <ProviderStatusCard status={claude} />

      {showSettings && claude?.state === 'authenticated' && (
        <div className="agent-settings">
          <label className="agent-setting-row">
            <span>{t('agent.permissionMode')}</span>
            <select
              value={permissionMode}
              onChange={(e) => setPermissionMode(e.target.value as PermissionMode)}
            >
              {PERMISSION_MODES.map((m) => (
                <option key={m} value={m}>
                  {t(PERMISSION_LABEL[m])}
                </option>
              ))}
            </select>
          </label>
          <div className="agent-setting-hint">{t('agent.permissionHint')}</div>
        </div>
      )}

      <UsagePanel />

      {claude?.state === 'authenticated' && (
        <>
          <div className="agent-sessions">
            {order.map((id) => {
              const v = sessionsById[id]
              return (
                <SessionTab
                  key={id}
                  view={v}
                  active={id === activeId}
                  onSelect={() => setActive(id)}
                  onRename={(title) => void rename(id, title)}
                  onClose={() => void closeSession(id)}
                />
              )
            })}
            <button
              className="agent-new"
              disabled={!root}
              title={root ? t('agent.newSession') : t('agent.noWorkspace')}
              onClick={() => void createSession('claude-code')}
            >
              + {t('agent.newSession')}
            </button>
          </div>

          {!root ? (
            <div className="empty-hint">{t('agent.noWorkspace')}</div>
          ) : (
            <Conversation view={active} />
          )}
        </>
      )}
    </div>
  )
}

function SessionTab({
  view,
  active,
  onSelect,
  onRename,
  onClose
}: {
  view: SessionView
  active: boolean
  onSelect: () => void
  onRename: (title: string) => void
  onClose: () => void
}): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(view.session.title)

  const commit = (): void => {
    setEditing(false)
    const clean = draft.trim()
    if (clean && clean !== view.session.title) onRename(clean)
    else setDraft(view.session.title)
  }

  return (
    <button
      className={`agent-session ${active ? 'active' : ''}`}
      onClick={onSelect}
      title={view.session.workspacePath}
    >
      <span className={`dot ${view.session.status}`} />
      {editing ? (
        <input
          className="agent-session-edit"
          value={draft}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft(view.session.title)
              setEditing(false)
            }
          }}
        />
      ) : (
        <span
          className="agent-session-title"
          onDoubleClick={(e) => {
            e.stopPropagation()
            setDraft(view.session.title)
            setEditing(true)
          }}
        >
          {view.session.title}
        </span>
      )}
      <span
        className="agent-session-close"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        ×
      </span>
    </button>
  )
}

function ProviderStatusCard({ status }: { status?: ProviderStatus }): JSX.Element {
  const t = useT()
  const setTerminal = useUiStore((s) => s.setTerminal)

  if (!status) {
    return <div className="agent-status checking">{t('agent.checking')}</div>
  }

  const badge =
    status.state === 'authenticated'
      ? '✓'
      : status.state === 'not-installed'
        ? '✕'
        : '⚠'

  return (
    <div className={`agent-status ${status.state}`}>
      <div className="agent-status-row">
        <strong>{status.name}</strong>
        <span className="agent-badge">{badge}</span>
      </div>
      {status.version && (
        <div className="agent-status-line">
          {t('agent.version', { v: status.version })}
          {status.compatibility && (
            <span className={`compat ${status.compatibility}`}>
              {status.compatibility === 'supported'
                ? t('agent.compatSupported')
                : t('agent.compatUnknown')}
            </span>
          )}
        </div>
      )}
      {status.detail && <div className="agent-status-detail">{status.detail}</div>}
      {status.state === 'not-installed' && (
        <div className="agent-status-detail">{t('agent.installHint')}</div>
      )}
      {(status.state === 'unauthenticated' || status.state === 'installed') && (
        <button className="agent-open-terminal" onClick={() => setTerminal(true)}>
          {t('agent.openTerminal')}
        </button>
      )}
    </div>
  )
}

function Conversation({ view }: { view: SessionView | null }): JSX.Element {
  const t = useT()
  const { submitComposer, stop, openDiff, prefill, consumePrefill, attachments, toggleAttachment } =
    useAgentStore()
  const [text, setText] = useState('')
  const [mentionOpen, setMentionOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const working = view?.session.status === 'working' || view?.session.status === 'starting'

  // Consume an external prefill (editor menu / Problems tab).
  useEffect(() => {
    if (!prefill) return
    setText(prefill.text)
    for (const k of prefill.contexts) {
      if (!useAgentStore.getState().attachments.includes(k)) toggleAttachment(k)
    }
    consumePrefill()
    taRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.nonce])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [view?.items])

  const submit = (): void => {
    const trimmed = text.trim()
    if (!trimmed || working) return
    void submitComposer(trimmed)
    setText('')
    setMentionOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Escape' && working && view) {
      e.preventDefault()
      void stop(view.session.id)
      return
    }
    // Enter (or Ctrl/Cmd+Enter) sends; Shift+Enter is a newline.
    if (e.key === 'Enter' && (!e.shiftKey || e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      submit()
    }
  }

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const v = e.target.value
    setText(v)
    // Open the mention menu when the caret sits right after a lone "@".
    const caret = e.target.selectionStart
    const prev = v.slice(0, caret)
    setMentionOpen(/(^|\s)@$/.test(prev))
  }

  const pickMention = (kind: ContextKind): void => {
    if (!attachments.includes(kind)) toggleAttachment(kind)
    setText((cur) => cur.replace(/@$/, `${CONTEXT_META[kind].mention} `))
    setMentionOpen(false)
    taRef.current?.focus()
  }

  return (
    <div className="agent-convo">
      <div className="agent-messages" ref={scrollRef}>
        {view ? (
          view.items.map((item, i) => <ChatItemView key={i} item={item} />)
        ) : (
          <div className="empty-hint">{t('agent.startHint')}</div>
        )}
        {working && <div className="agent-working">{t('agent.working')}</div>}
      </div>

      {view && view.fileChanges.length > 0 && (
        <FileChanges view={view} onDiff={(p) => openDiff(view.session.id, p)} />
      )}

      <QuickActions disabled={working} />

      <ContextBar />

      <div className="agent-input">
        {mentionOpen && (
          <div className="mention-menu">
            {CONTEXT_ORDER.map((k) => (
              <button key={k} onMouseDown={(e) => e.preventDefault()} onClick={() => pickMention(k)}>
                {CONTEXT_META[k].icon} {CONTEXT_META[k].mention}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={taRef}
          value={text}
          placeholder={t('agent.placeholder')}
          onChange={onChange}
          onKeyDown={onKeyDown}
        />
        {working ? (
          <button className="agent-stop" onClick={() => view && void stop(view.session.id)}>
            {t('agent.stop')}
          </button>
        ) : (
          <button className="agent-send" disabled={!text.trim()} onClick={submit}>
            {t('agent.send')}
          </button>
        )}
      </div>
    </div>
  )
}

function QuickActions({ disabled }: { disabled: boolean }): JSX.Element {
  const t = useT()
  const runQuickAction = useAgentStore((s) => s.runQuickAction)
  return (
    <div className="agent-quick">
      {QUICK_ACTIONS.map((a) => (
        <button
          key={a.id}
          disabled={disabled}
          title={a.prompt}
          onClick={() => void runQuickAction(a)}
        >
          {t(a.labelKey)}
        </button>
      ))}
    </div>
  )
}

function ContextBar(): JSX.Element {
  const t = useT()
  const { attachments, toggleAttachment } = useAgentStore()
  const [open, setOpen] = useState(false)
  const avail = contextAvailability()

  return (
    <div className="agent-context">
      <div className="agent-context-add">
        <button className="ctx-add-btn" onClick={() => setOpen((v) => !v)}>
          + {t('agent.context')}
        </button>
        {open && (
          <div className="ctx-menu" onMouseLeave={() => setOpen(false)}>
            {CONTEXT_ORDER.map((k) => (
              <button
                key={k}
                className={attachments.includes(k) ? 'on' : ''}
                disabled={!avail[k]}
                onClick={() => toggleAttachment(k)}
              >
                <span className="ctx-check">{attachments.includes(k) ? '✓' : ''}</span>
                {CONTEXT_META[k].icon} {t(CONTEXT_LABEL[k])}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="ctx-chips">
        {attachments.map((k) => (
          <span key={k} className="ctx-chip">
            {CONTEXT_META[k].icon} {t(CONTEXT_LABEL[k])}
            <span className="ctx-chip-x" onClick={() => toggleAttachment(k)}>
              ×
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

function ChatItemView({ item }: { item: ChatItem }): JSX.Element {
  const t = useT()
  switch (item.type) {
    case 'user':
      return (
        <div className="msg user">
          <div className="msg-role">{t('agent.you')}</div>
          <div className="msg-body">{item.text}</div>
          {item.contexts && item.contexts.length > 0 && (
            <div className="msg-ctx">
              {item.contexts.map((k) => (
                <span key={k} className="ctx-chip small">
                  {CONTEXT_META[k].icon} {t(CONTEXT_LABEL[k])}
                </span>
              ))}
            </div>
          )}
        </div>
      )
    case 'assistant':
      return (
        <div className="msg assistant">
          <div className="msg-role">
            <span>Claude Code</span>
            <CopyButton text={item.text} />
          </div>
          <div className="msg-body">
            <Markdown text={item.text} />
          </div>
        </div>
      )
    case 'thinking':
      return (
        <details className="msg thinking">
          <summary>{t('agent.thinking')}</summary>
          <div className="msg-body">{item.text}</div>
        </details>
      )
    case 'tool':
      return (
        <div className={`tool ${item.call.status}`}>
          <span className="tool-icon">
            {item.call.status === 'running' ? '⟳' : item.call.status === 'error' ? '✕' : '✓'}
          </span>
          <span className="tool-summary">{item.call.summary}</span>
        </div>
      )
    case 'permission':
      return (
        <div className="msg permission">
          ⚠ {t('agent.blocked', { tool: item.tool })}
          <div className="msg-body">{item.detail}</div>
        </div>
      )
    case 'error':
      return <div className="msg error">{item.friendly}</div>
    case 'completed':
      return (
        <div className="msg completed">
          {t('agent.completed')}
          {typeof item.costUsd === 'number' && (
            <span className="cost"> · ${item.costUsd.toFixed(4)}</span>
          )}
        </div>
      )
  }
}

function FileChanges({
  view,
  onDiff
}: {
  view: SessionView
  onDiff: (path: string) => void
}): JSX.Element {
  const t = useT()
  const openFile = useEditorStore((s) => s.openFile)
  const mark = (c: string): string => (c === 'created' ? 'A' : c === 'deleted' ? 'D' : 'M')
  return (
    <div className="agent-changes">
      <div className="agent-changes-header">
        {t('agent.changes', { n: view.fileChanges.length })}
      </div>
      {view.fileChanges.map((f) => (
        <div key={f.path} className="agent-change" title={f.path}>
          <span className={`change-mark ${f.changeType}`}>{mark(f.changeType)}</span>
          <button
            className="change-path"
            onClick={() => void openFile(f.path, f.path.split(/[\\/]/).pop() ?? f.path)}
          >
            {f.path.split(/[\\/]/).pop()}
          </button>
          {f.changeType !== 'deleted' && (
            <button className="change-diff" onClick={() => onDiff(f.path)}>
              {t('agent.viewDiff')}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
