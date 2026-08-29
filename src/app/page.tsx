'use client'

import { initSession, sendMessage, stopMessage } from '@/api/ai-api'
import type { ChatMessage, ChatStreamEvent } from '@/types/ai'
import { Bot, CircleStop, MessageSquarePlus, Send, Sparkles, UserRound } from 'lucide-react'
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import './chat-page.scss'

const welcomeMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '你好，我是你的 AI 助手。今天想聊点什么？',
  createdAt: 0,
  status: 'done'
}

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: crypto.randomUUID(), role, content, createdAt: Date.now(), status: role === 'assistant' ? 'streaming' : 'done' }
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    startNewSession()
  }, [])

  useEffect(() => {
    const element = messagesRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages])

  async function startNewSession() {
    setInitializing(true)
    setError('')
    try {
      const nextSessionId = await initSession()
      setSessionId(nextSessionId)
      setMessages([{ ...welcomeMessage, id: crypto.randomUUID(), createdAt: Date.now() }])
      setInput('')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setInitializing(false)
    }
  }

  function updateAssistantMessage(id: string, event: ChatStreamEvent) {
    setMessages(current =>
      current.map(message => {
        if (message.id !== id) return message
        if (event.type === 'Text') return { ...message, content: message.content + event.text }
        if (event.type === 'Error') return { ...message, content: message.content || event.message, status: 'error' }
        if (event.type === 'Done') return { ...message, status: 'done' }
        return message
      })
    )
  }

  async function submitMessage() {
    const content = input.trim()
    if (!content || loading || !sessionId) return

    const userMessage = createMessage('user', content)
    const assistantMessage = createMessage('assistant', '')
    setMessages(current => [...current, userMessage, assistantMessage])
    setInput('')
    setError('')
    setLoading(true)

    try {
      await sendMessage(sessionId, content, event => updateAssistantMessage(assistantMessage.id, event))
    } catch (nextError) {
      updateAssistantMessage(assistantMessage.id, {
        type: 'Error',
        message: nextError instanceof Error ? nextError.message : String(nextError)
      })
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    submitMessage()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submitMessage()
    }
  }

  async function handleStop() {
    if (sessionId) await stopMessage(sessionId).catch(() => undefined)
    setLoading(false)
  }

  return (
    <main className="chat-page">
      <aside className="chat-sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Sparkles size={19} />
          </span>
          <div>
            <strong>Ark Agent</strong>
            <span>LangChain Responses</span>
          </div>
        </div>
        <button className="new-chat-button" type="button" onClick={startNewSession} disabled={initializing || loading}>
          <MessageSquarePlus size={17} />
          新建对话
        </button>
        <div className="sidebar-section">
          <span className="sidebar-title">当前会话</span>
          <div className="conversation-item active">
            <Bot size={16} />
            <span>Responses API 对话</span>
          </div>
        </div>
        <div className="sidebar-status">
          <span className={sessionId ? 'status-dot online' : 'status-dot'} />
          <div>
            <strong>{sessionId ? '已连接方舟' : '等待连接'}</strong>
            <span>{sessionId ? sessionId.slice(0, 14) : '请检查配置'}</span>
          </div>
        </div>
      </aside>

      <section className="chat-main">
        <header className="chat-header">
          <div>
            <h1>AI 智能助手</h1>
            <p>LangChain Agent · Ark Responses API · store: true</p>
          </div>
          <span className="model-badge">{initializing ? '连接中' : sessionId ? '在线' : '离线'}</span>
        </header>
        <div className="messages" ref={messagesRef}>
          {messages.map(message => (
            <article className={`message ${message.role}`} key={message.id}>
              <div className="message-avatar">{message.role === 'assistant' ? <Bot size={18} /> : <UserRound size={17} />}</div>
              <div className="message-body">
                <div className="message-meta">
                  <strong>{message.role === 'assistant' ? 'Ark Agent' : '你'}</strong>
                  <span>
                    {message.createdAt
                      ? new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </span>
                </div>
                <div className={`message-content ${message.status === 'error' ? 'error' : ''}`}>
                  {message.content || (
                    <span className="typing-indicator">
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
        <footer className="composer-area">
          {error && <div className="error-banner">{error}</div>}
          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={initializing ? '正在初始化会话...' : '输入你的问题'}
              rows={2}
              disabled={!sessionId || initializing}
            />
            <div className="composer-actions">
              {loading ? (
                <button className="stop-button" type="button" onClick={handleStop} title="停止生成">
                  <CircleStop size={17} />
                  停止
                </button>
              ) : (
                <button className="send-button" type="submit" disabled={!input.trim() || !sessionId} title="发送消息">
                  <Send size={17} />
                  发送
                </button>
              )}
            </div>
          </form>
          <p className="composer-hint">响应会自动保存上下文，下一轮通过 previous_response_id 延续。</p>
        </footer>
      </section>
    </main>
  )
}
