import { useEffect, useRef, useState, type JSX } from 'react'
import { useChatStore } from '@renderer/stores/chatStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'

/** Right-hand AI chat panel with streaming responses and a model picker. */
export function ChatPanel(): JSX.Element {
  const { messages, streaming, send, cancel, clear } = useChatStore()
  const { models, selectedModel, selectModel } = useSettingsStore()
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const submit = (): void => {
    if (!text.trim() || streaming) return
    void send(text)
    setText('')
  }

  const noModels = models.length === 0

  return (
    <div className="chat">
      <div className="sidebar-header">
        <span>AI Chat</span>
        <button title="Clear conversation" onClick={clear}>
          🗑
        </button>
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="empty-hint" style={{ padding: 0 }}>
            {noModels
              ? 'No models available. Add a provider API key in Settings (⚙) to start chatting.'
              : 'Ask anything about your code. Responses stream in live.'}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="who">{m.role === 'user' ? 'You' : 'Lumixa'}</div>
            <div className="bubble">
              {m.content}
              {m.streaming && <span className="cursor">▋</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="chat-input">
        <textarea
          placeholder={noModels ? 'Configure a provider first…' : 'Message Lumixa…'}
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
            {noModels && <option value="">No models</option>}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
          {streaming ? (
            <button className="send" onClick={cancel}>
              Stop
            </button>
          ) : (
            <button className="send" onClick={submit} disabled={noModels || !text.trim()}>
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
