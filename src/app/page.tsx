'use client'

import {
  deleteSession,
  getSession,
  initSession,
  listSessions,
  sendApproval,
  sendMessage,
  stopMessage,
  updateSession,
  type SessionSummary
} from '@/api/ai-api'
import type { ChatMessage, ChatStreamEvent, PendingApproval } from '@/types/ai'
import { Bot, CircleStop, MessageSquarePlus, Send, ShieldCheck, UserRound, X } from 'lucide-react'
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import './chat-page.scss'

const sessionStorageKey = 'ark-agent-session'

const welcomeMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '你好，我是你的 AI 助手。今天想聊点什么？',
  createdAt: 0,
  status: 'done'
}

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: Date.now(),
    status: role === 'assistant' ? 'streaming' : 'done'
  }
}

function withWelcome(messages: ChatMessage[]) {
  if (messages.some(message => message.id === welcomeMessage.id || message.content === welcomeMessage.content)) return messages
  return [{ ...welcomeMessage, id: crypto.randomUUID(), createdAt: Date.now() }, ...messages]
}

function formatArgs(args: unknown) {
  if (args === undefined) return ''
  try {
    return JSON.stringify(args, null, 2)
  } catch {
    return String(args)
  }
}

function formatMessageDate(timestamp: number) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState('')
  const [sessionList, setSessionList] = useState<SessionSummary[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage])
  const [pendingApproval, setPendingApproval] = useState<PendingApproval>()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)
  const assistantMessageIdRef = useRef('')

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    restoreSession()
  }, [])

  useEffect(() => {
    const element = messagesRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages])

  useEffect(() => {
    if (!sessionId || initializing) return
    localStorage.setItem(sessionStorageKey, sessionId)
  }, [initializing, sessionId])

  async function restoreSession() {
    setInitializing(true)
    setError('')
    const saved = readStoredSession()

    if (saved) {
      try {
        await loadSession(saved)
        setInitializing(false)
        return
      } catch {
        localStorage.removeItem(sessionStorageKey)
      }
    }

    try {
      const sessions = await listSessions()
      setSessionList(sessions)
      if (sessions[0]) {
        await loadSession(sessions[0].id)
        setInitializing(false)
        return
      }
    } catch {
      // 创建新会话时会再次报告错误
    }

    await startNewSession()
  }

  async function loadSession(nextSessionId: string) {
    const snapshot = await getSession(nextSessionId)
    setSessionId(snapshot.sessionId)
    setMessages(withWelcome(snapshot.messages))
    setPendingApproval(snapshot.pendingApproval)
    const sessions = await listSessions().catch(() => [])
    setSessionList(sessions)
  }

  function readStoredSession() {
    try {
      const raw = localStorage.getItem(sessionStorageKey)
      if (!raw) return undefined
      return raw
    } catch {
      return undefined
    }
  }

  async function startNewSession() {
    setInitializing(true)
    setError('')
    setPendingApproval(undefined)
    assistantMessageIdRef.current = ''
    try {
      const nextSessionId = await initSession()
      setSessionId(nextSessionId)
      setMessages([{ ...welcomeMessage, id: crypto.randomUUID(), createdAt: Date.now() }])
      setInput('')
      const sessions = await listSessions().catch(() => [])
      setSessionList(sessions)
    } catch (nextError) {
      setSessionId('')
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setInitializing(false)
    }
  }

  function updateAssistantMessage(id: string, event: ChatStreamEvent) {
    if (event.type === 'Approval') setPendingApproval(event.approval)
    if (event.type === 'Error') setError(event.message)

    setMessages(current =>
      current.map(message => {
        if (message.id !== id) return message
        if (event.type === 'Text') return { ...message, content: message.content + event.text }
        if (event.type === 'Error') return { ...message, content: message.content || event.message, status: 'error' }
        if (event.type === 'Done') return { ...message, status: event.interrupted ? 'streaming' : 'done' }
        return message
      })
    )
  }

  function ensureAssistantMessage() {
    if (assistantMessageIdRef.current) return assistantMessageIdRef.current
    const assistantMessage = createMessage('assistant', '')
    assistantMessageIdRef.current = assistantMessage.id
    setMessages(current => [...current, assistantMessage])
    return assistantMessage.id
  }

  async function submitMessage() {
    const content = input.trim()
    if (!content || loading || !sessionId || pendingApproval) return

    const userMessage = createMessage('user', content)
    const assistantMessage = createMessage('assistant', '')
    assistantMessageIdRef.current = assistantMessage.id
    setMessages(current => [...current, userMessage, assistantMessage])
    setInput('')
    setError('')
    setLoading(true)

    try {
      await sendMessage(sessionId, content, event => updateAssistantMessage(assistantMessage.id, event))
      setSessionList(await listSessions().catch(() => sessionList))
    } catch (nextError) {
      updateAssistantMessage(assistantMessage.id, {
        type: 'Error',
        message: nextError instanceof Error ? nextError.message : String(nextError)
      })
    } finally {
      setLoading(false)
    }
  }

  async function renameSession(target: SessionSummary) {
    const title = window.prompt('输入新的会话标题', target.title)?.trim()
    if (!title || title === target.title) return
    try {
      const updated = await updateSession(target.id, title)
      setSessionList(current => current.map(item => (item.id === updated.id ? updated : item)))
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  async function removeSession(target: SessionSummary) {
    if (!window.confirm(`确定删除“${target.title}”吗？`)) return
    try {
      await deleteSession(target.id)
      const nextList = sessionList.filter(item => item.id !== target.id)
      setSessionList(nextList)
      if (target.id === sessionId) {
        if (nextList[0]) await loadSession(nextList[0].id)
        else await startNewSession()
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  async function approvePending(approved: boolean) {
    if (!pendingApproval || !sessionId || loading) return
    const assistantId = ensureAssistantMessage()
    const decisions = pendingApproval.requests.map(request =>
      approved && request.allowedDecisions.includes('approve')
        ? { type: 'approve' as const }
        : { type: 'reject' as const, message: '用户拒绝了这次工具调用，请不要重试，向用户说明后续方案。' }
    )

    setPendingApproval(undefined)
    setError('')
    setLoading(true)
    try {
      await sendApproval(sessionId, decisions, event => updateAssistantMessage(assistantId, event))
      setSessionList(await listSessions().catch(() => sessionList))
    } catch (nextError) {
      updateAssistantMessage(assistantId, {
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
            <ShieldCheck size={19} />
          </span>
          <div>
            <strong>Deep Agent</strong>
            <span>LangGraph runtime</span>
          </div>
        </div>
        <button className="new-chat-button" type="button" onClick={startNewSession} disabled={initializing || loading}>
          <MessageSquarePlus size={17} />
          新建对话
        </button>
        <div className="sidebar-section">
          <span className="sidebar-title">会话列表</span>
          <div className="conversation-list">
            {sessionList.map(session => (
              <div className={`conversation-item ${session.id === sessionId ? 'active' : ''}`} key={session.id}>
                <button type="button" onClick={() => loadSession(session.id)} disabled={initializing || loading}>
                  <Bot size={16} />
                  <span>{session.title}</span>
                </button>
                <div className="conversation-actions">
                  <button type="button" onClick={() => renameSession(session)} disabled={loading} title="重命名">
                    编辑
                  </button>
                  <button type="button" onClick={() => removeSession(session)} disabled={loading} title="删除">
                    删除
                  </button>
                </div>
              </div>
            ))}
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
            <p>Deep Agents · MemorySaver · src/skills</p>
          </div>
          <span className="model-badge">{initializing ? '连接中' : sessionId ? '在线' : '离线'}</span>
        </header>
        <div className="messages" ref={messagesRef}>
          {messages.map(message => (
            <article className={`message ${message.role}`} key={message.id}>
              <div className="message-avatar">{message.role === 'assistant' ? <Bot size={18} /> : <UserRound size={17} />}</div>
              <div className="message-body">
                <div className="message-meta">
                  <strong>{message.role === 'assistant' ? 'Deep Agent' : '你'}</strong>
                  <span>
                    {formatMessageDate(message.createdAt)}
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
          {pendingApproval && (
            <section className="approval-panel" aria-live="polite">
              <div className="approval-header">
                <div>
                  <ShieldCheck size={17} />
                  <strong>需要人工审批</strong>
                </div>
                <span>{pendingApproval.requests.length} 个工具调用</span>
              </div>
              <div className="approval-list">
                {pendingApproval.requests.map(request => (
                  <div className="approval-item" key={request.id}>
                    <div className="approval-item-title">
                      <strong>{request.name}</strong>
                      <span>{request.description || '该操作可能修改文件或执行外部命令'}</span>
                    </div>
                    <pre>{formatArgs(request.args)}</pre>
                  </div>
                ))}
              </div>
              <div className="approval-actions">
                <button className="approval-reject" type="button" onClick={() => approvePending(false)} disabled={loading}>
                  <X size={16} />
                  拒绝
                </button>
                <button className="approval-approve" type="button" onClick={() => approvePending(true)} disabled={loading}>
                  <ShieldCheck size={16} />
                  批准并继续
                </button>
              </div>
            </section>
          )}
          {error && <div className="error-banner">{error}</div>}
          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={initializing ? '正在恢复会话...' : pendingApproval ? '请先处理待审批操作' : '输入你的问题'}
              rows={2}
              disabled={!sessionId || initializing || Boolean(pendingApproval)}
            />
            <div className="composer-actions">
              {loading ? (
                <button className="stop-button" type="button" onClick={handleStop} title="停止生成">
                  <CircleStop size={17} />
                  停止
                </button>
              ) : (
                <button
                  className="send-button"
                  type="submit"
                  disabled={!input.trim() || !sessionId || Boolean(pendingApproval)}
                  title="发送消息"
                >
                  <Send size={17} />
                  发送
                </button>
              )}
            </div>
          </form>
        </footer>
      </section>
    </main>
  )
}
