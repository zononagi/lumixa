import { useEffect, useRef, useState, type JSX } from 'react'
import type { ProviderStatus } from '@shared/agent'
import { useAgentStore, type ChatItem, type SessionView } from '@renderer/stores/agentStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useUiStore } from '@renderer/stores/uiStore'
import { UsagePanel } from './UsagePanel'
import { Markdown, CopyButton } from './Markdown'
import { useT } from '@renderer/i18n'

/**
 * AI Agent panel. Drives the user's local Claude Code CLI through the generic
 * agent runtime and renders its streaming output (messages, tool calls, file
 * changes) in real time. No Claude-specific logic lives here.
 */
export function AgentPanel(): JSX.Element {
  const t = useT()
  const {
    providers,
    sessionsById,
    order,
    activeId,
    init,
    refreshProviders,
    createSession,
    setActive,
    closeSession
  } = useAgentStore()
  const root = useWorkspaceStore((s) => s.root)

  useEffect(() => {
    init()
  }, [init])

  const claude = providers.find((p) => p.id === 'claude-code')
  const active = activeId ? sessionsById[activeId] : null

  return (
    <div className="sidebar agent">
      <div className="sidebar-header">
        <span>{t('agent.title')}</span>
        <button title={t('agent.refresh')} onClick={() => void refreshProviders()}>
          ↻
        </button>
      </div>

      <ProviderStatusCard status={claude} />
      <UsagePanel />

      {claude?.state === 'authenticated' && (
        <>
          <div className="agent-sessions">
            {order.map((id) => {
              const v = sessionsById[id]
              return (
                <button
                  key={id}
                  className={`agent-session ${id === activeId ? 'active' : ''}`}
                  onClick={() => setActive(id)}
                  title={v.session.workspacePath}
                >
                  <span className={`dot ${v.session.status}`} />
                  <span className="agent-session-title">{v.session.title}</span>
                  <span
                    className="agent-session-close"
                    onClick={(e) => {
                      e.stopPropagation()
                      void closeSession(id)
                    }}
                  >
                    ×
                  </span>
                </button>
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

          {!root && <div className="empty-hint">{t('agent.noWorkspace')}</div>}
          {active ? (
            <Conversation view={active} />
          ) : (
            root && <div className="empty-hint">{t('agent.startHint')}</div>
          )}
        </>
      )}
    </div>
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
      {(status.state === 'unauthenticated' || status.state === 'installed') && (
        <button className="agent-open-terminal" onClick={() => setTerminal(true)}>
          {t('agent.openTerminal')}
        </button>
      )}
    </div>
  )
}

function Conversation({ view }: { view: SessionView }): JSX.Element {
  const t = useT()
  const { send, stop } = useAgentStore()
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const working = view.session.status === 'working' || view.session.status === 'starting'

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [view.items])

  const submit = (): void => {
    const trimmed = text.trim()
    if (!trimmed || working) return
    void send(view.session.id, trimmed)
    setText('')
  }

  return (
    <div className="agent-convo">
      <div className="agent-messages" ref={scrollRef}>
        {view.items.map((item, i) => (
          <ChatItemView key={i} item={item} />
        ))}
        {working && <div className="agent-working">{t('agent.working')}</div>}
      </div>

      {view.fileChanges.length > 0 && <FileChanges view={view} />}

      <div className="agent-input">
        <textarea
          value={text}
          placeholder={t('agent.placeholder')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        {working ? (
          <button className="agent-stop" onClick={() => void stop(view.session.id)}>
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

function ChatItemView({ item }: { item: ChatItem }): JSX.Element {
  const t = useT()
  switch (item.type) {
    case 'user':
      return (
        <div className="msg user">
          <div className="msg-role">{t('agent.you')}</div>
          <div className="msg-body">{item.text}</div>
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
      return <details className="msg thinking">
        <summary>{t('agent.thinking')}</summary>
        <div className="msg-body">{item.text}</div>
      </details>
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

function FileChanges({ view }: { view: SessionView }): JSX.Element {
  const t = useT()
  const openFile = useEditorStore((s) => s.openFile)
  const mark = (c: string): string => (c === 'created' ? 'A' : c === 'deleted' ? 'D' : 'M')
  return (
    <div className="agent-changes">
      <div className="agent-changes-header">
        {t('agent.changes', { n: view.fileChanges.length })}
      </div>
      {view.fileChanges.map((f) => (
        <button
          key={f.path}
          className="agent-change"
          title={f.path}
          onClick={() => void openFile(f.path, f.path.split(/[\\/]/).pop() ?? f.path)}
        >
          <span className={`change-mark ${f.changeType}`}>{mark(f.changeType)}</span>
          <span className="change-path">{f.path.split(/[\\/]/).pop()}</span>
        </button>
      ))}
    </div>
  )
}
