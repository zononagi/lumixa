import { useEffect, useRef, useState, type JSX } from 'react'
import { useChatStore } from '@renderer/stores/chatStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useAgentsStore } from '@renderer/stores/agentsStore'
import { useTasksStore } from '@renderer/stores/tasksStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { MarkdownMessage } from './MarkdownMessage'
import { useT } from '@renderer/i18n'

/** Right-hand AI chat panel with streaming responses and a model picker. */
export function ChatPanel(): JSX.Element {
  const { messages, streaming, send, cancel, clear, note } = useChatStore()
  const { models, selectedModel, selectModel } = useSettingsStore()
  const { agents, activeId, setActive, active } = useAgentsStore()
  const runTask = useTasksStore((s) => s.run)
  const running = useTasksStore((s) => s.tasks.filter((tk) => tk.status === 'running').length)
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const t = useT()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const submit = (): void => {
    if (!text.trim() || streaming) return
    void send(text)
    setText('')
  }

  const runBackground = (): void => {
    const prompt = text.trim()
    if (!prompt) return
    const agent = active()
    const projectContext = useWorkspaceStore.getState().projectContext
    const system = agent.systemPrompt + (projectContext ? `\n\n${projectContext}` : '')
    setText('')
    void runTask(`${agent.name}: ${prompt.slice(0, 40)}`, system, prompt, agent.model ?? undefined).then(
      (id) => {
        const task = useTasksStore.getState().tasks.find((tk) => tk.id === id)
        if (task?.result) note(`🕒 ${task.title}\n\n${task.result}`)
        else if (task?.error) note(`⚠️ ${task.title}: ${task.error}`)
      }
    )
  }

  const noModels = models.length === 0
  const agentName = active().name

  return (
    <div className="chat">
      <div className="sidebar-header">
        <span>{t('chat.title')}</span>
        <span className="spacer" />
        {running > 0 && <span className="bg-badge">🕒 {running}</span>}
        <button title={t('chat.clear')} onClick={clear}>
          🗑
        </button>
      </div>

      <div className="chat-agentbar">
        <select value={activeId} onChange={(e) => setActive(e.target.value)}>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              🤖 {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="empty-hint" style={{ padding: 0 }}>
            {noModels ? t('chat.emptyNoModel') : t('chat.empty')}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="who">{m.role === 'user' ? t('chat.you') : agentName}</div>
            <div className="bubble">
              {m.role === 'assistant' ? <MarkdownMessage content={m.content} /> : m.content}
              {m.streaming && <span className="cursor">▋</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="chat-input">
        <textarea
          placeholder={noModels ? t('chat.placeholderNoModel') : t('chat.placeholder')}
          value={text}
          disabled={noModels}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <div className="row">
          <select
            value={selectedModel ?? ''}
            onChange={(e) => selectModel(e.target.value)}
            disabled={noModels}
          >
            {noModels && <option value="">{t('chat.noModels')}</option>}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
          {streaming ? (
            <button className="send" onClick={cancel}>
              {t('chat.stop')}
            </button>
          ) : (
            <>
              <button
                className="bg-run"
                title={t('chat.background')}
                onClick={runBackground}
                disabled={noModels || !text.trim()}
              >
                🕒
              </button>
              <button className="send" onClick={submit} disabled={noModels || !text.trim()}>
                {t('chat.send')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
