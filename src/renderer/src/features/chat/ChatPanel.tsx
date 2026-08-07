import { useEffect, useRef, useState, type JSX } from 'react'
import { useChatStore } from '@renderer/stores/chatStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useT } from '@renderer/i18n'

/** Right-hand AI chat panel with streaming responses and a model picker. */
export function ChatPanel(): JSX.Element {
  const { messages, streaming, send, cancel, clear } = useChatStore()
  const { models, selectedModel, selectModel } = useSettingsStore()
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

  const noModels = models.length === 0

  return (
    <div className="chat">
      <div className="sidebar-header">
        <span>{t('chat.title')}</span>
        <button title={t('chat.clear')} onClick={clear}>
          🗑
        </button>
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="empty-hint" style={{ padding: 0 }}>
            {noModels ? t('chat.emptyNoModel') : t('chat.empty')}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="who">{m.role === 'user' ? t('chat.you') : 'Lumixa'}</div>
            <div className="bubble">
              {m.content}
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
            <button className="send" onClick={submit} disabled={noModels || !text.trim()}>
              {t('chat.send')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
