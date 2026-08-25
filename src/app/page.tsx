'use client'

import { FormEvent, useRef, useState } from 'react'
import { Bot, Check, ChevronDown, MessageCircle, MoreHorizontal, Paperclip, Plus, Send, Sparkles, User } from 'lucide-react'
import './page.scss'

type Message = {
  id: string
  role: 'assistant' | 'user' | 'tool'
  content: string
  time: string
  toolPhase?: 'call' | 'result'
  toolName?: string
  approvalId?: string
  approvalStatus?: 'pending' | 'approved' | 'rejected'
}

const baseUrl = 'http://172.16.87.41:8666'

function getTime() {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date())
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getContentPartText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(getContentPartText).join('')
  }

  if (typeof value !== 'object' || value === null) {
    return ''
  }

  const part = value as Record<string, unknown>
  for (const key of ['text', 'content', 'value', 'delta', 'part']) {
    const text = getContentPartText(part[key])
    if (text) {
      return text
    }
  }

  return ''
}

function getStreamText(payload: Record<string, unknown>) {
  if (payload.type === 'response.output_text.delta' && typeof payload.delta === 'string') {
    return { text: payload.delta, isContentPart: false }
  }

  if (payload.type === 'response.content_part.added' || payload.type === 'response.content_part.done') {
    return { text: getContentPartText(payload.part), isContentPart: true }
  }

  return undefined
}

function parseStreamChunk(chunk: string) {
  const frames = chunk.split(/\r?\n\r?\n/)
  const remaining = frames.pop() || ''
  let text = ''
  let contentPart = ''
  const toolEvents: Array<{ phase: 'call' | 'result'; name: string; content: string; approvalId?: string; approved?: boolean }> =
    []

  for (const frame of frames) {
    const lines = frame.split(/\r?\n/)
    const value = lines
      .find(line => line.startsWith('data:'))
      ?.slice(5)
      .trim()
    if (!value || value === '[DONE]') continue

    try {
      const parsed = JSON.parse(value)
      if (parsed.type === 'tool_approval_required') {
        toolEvents.push({
          phase: 'call',
          name: parsed.name || '未知工具',
          content: parsed.arguments || '{}',
          approvalId: parsed.approvalId
        })
      } else if (parsed.type === 'tool_result') {
        toolEvents.push({
          phase: 'result',
          name: parsed.name || '未知工具',
          content: parsed.output || '',
          approved: parsed.approved
        })
      } else {
        const streamText = getStreamText(parsed)
        if (!streamText) {
          continue
        }
        if (streamText.isContentPart) {
          contentPart += streamText.text
        } else {
          text += streamText.text
        }
      }
    } catch {
      text += value
    }
  }

  return { remaining, text, contentPart, toolEvents }
}

function mergeContentPart(current: string, next: string) {
  if (!current || next === current) {
    return next || current
  }
  if (next.startsWith(current)) {
    return next
  }
  return current + next
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sessionId] = useState(() => `chat-${makeId()}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }))
  }

  const approveTool = async (message: Message, approved: boolean) => {
    if (!message.approvalId || message.approvalStatus !== 'pending') return

    setMessages(current =>
      current.map(item => (item.id === message.id ? { ...item, approvalStatus: approved ? 'approved' : 'rejected' } : item))
    )

    try {
      const response = await fetch(`${baseUrl}/api/chat/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, approvalId: message.approvalId, approved })
      })
      if (!response.ok) throw new Error('审批提交失败')
    } catch (error) {
      setMessages(current => current.map(item => (item.id === message.id ? { ...item, approvalStatus: 'pending' } : item)))
      setMessages(current => [
        ...current,
        { id: makeId(), role: 'assistant', content: error instanceof Error ? error.message : '审批提交失败', time: getTime() }
      ])
    }
  }

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const content = input.trim()
    if (!content || isSending) return

    setMessages(current => [...current, { id: makeId(), role: 'user', content, time: getTime() }])
    setInput('')
    setIsSending(true)
    scrollToBottom()

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: content })
      })
      if (!response.ok || !response.body) throw new Error('服务暂时不可用')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let streamBuffer = ''
      let assistantText = ''
      let assistantId = makeId()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        streamBuffer += decoder.decode(value, { stream: true })
        const parsed = parseStreamChunk(streamBuffer)
        streamBuffer = parsed.remaining

        if (parsed.toolEvents.length > 0) {
          if (parsed.toolEvents.some(toolEvent => toolEvent.phase === 'call')) {
            assistantText = ''
            assistantId = makeId()
          }

          setMessages(current => [
            ...current,
            ...parsed.toolEvents.map(toolEvent => ({
              id: makeId(),
              role: 'tool' as const,
              content: toolEvent.content,
              time: getTime(),
              toolPhase: toolEvent.phase,
              toolName: toolEvent.name,
              approvalId: toolEvent.approvalId,
              approvalStatus: (toolEvent.phase === 'call'
                ? 'pending'
                : toolEvent.approved
                  ? 'approved'
                  : 'rejected') as Message['approvalStatus']
            }))
          ])
        }

        if (parsed.text) {
          assistantText += parsed.text
          setMessages(current => {
            const assistantMessage = { id: assistantId, role: 'assistant' as const, content: assistantText, time: getTime() }
            const existingIndex = current.findIndex(message => message.id === assistantId)
            if (existingIndex === -1) return [...current, assistantMessage]
            return current.map(message => (message.id === assistantId ? assistantMessage : message))
          })
        }
        if (parsed.contentPart) {
          assistantText = mergeContentPart(assistantText, parsed.contentPart)
          setMessages(current => {
            const assistantMessage = { id: assistantId, role: 'assistant' as const, content: assistantText, time: getTime() }
            const existingIndex = current.findIndex(message => message.id === assistantId)
            if (existingIndex === -1) return [...current, assistantMessage]
            return current.map(message => (message.id === assistantId ? assistantMessage : message))
          })
        }
        scrollToBottom()
      }
      streamBuffer += decoder.decode()
      const finalParsed = parseStreamChunk(`${streamBuffer}\n\n`)
      if (finalParsed.toolEvents.length > 0) {
        if (finalParsed.toolEvents.some(toolEvent => toolEvent.phase === 'call')) {
          assistantText = ''
          assistantId = makeId()
        }

        setMessages(current => [
          ...current,
          ...finalParsed.toolEvents.map(toolEvent => ({
            id: makeId(),
            role: 'tool' as const,
            content: toolEvent.content,
            time: getTime(),
            toolPhase: toolEvent.phase,
            toolName: toolEvent.name,
            approvalId: toolEvent.approvalId,
            approvalStatus: (toolEvent.phase === 'call'
              ? 'pending'
              : toolEvent.approved
                ? 'approved'
                : 'rejected') as Message['approvalStatus']
          }))
        ])
      }
      if (finalParsed.text) {
        assistantText += finalParsed.text
        setMessages(current => {
          const assistantMessage = { id: assistantId, role: 'assistant' as const, content: assistantText, time: getTime() }
          const existingIndex = current.findIndex(message => message.id === assistantId)
          if (existingIndex === -1) return [...current, assistantMessage]
          return current.map(message => (message.id === assistantId ? assistantMessage : message))
        })
      }
      if (finalParsed.contentPart) {
        assistantText = mergeContentPart(assistantText, finalParsed.contentPart)
        setMessages(current => {
          const assistantMessage = { id: assistantId, role: 'assistant' as const, content: assistantText, time: getTime() }
          const existingIndex = current.findIndex(message => message.id === assistantId)
          if (existingIndex === -1) return [...current, assistantMessage]
          return current.map(message => (message.id === assistantId ? assistantMessage : message))
        })
      }
    } catch (error) {
      setMessages(current => [...current, { id: makeId(), role: 'assistant', content: error.message, time: getTime() }])
    } finally {
      setIsSending(false)
      scrollToBottom()
    }
  }

  return (
    <main className="chat-app">
      <aside className="sidebar " hidden>
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={17} strokeWidth={2.3} />
          </div>
          <span>M4 AI</span>
        </div>
        <button className="new-chat-button" type="button" onClick={() => setMessages([])}>
          <Plus size={18} />
          <span>新建对话</span>
        </button>
        <div className="sidebar-section">
          <p className="section-label">最近对话</p>
        </div>
        <div className="sidebar-footer">
          <div className="profile-avatar">林</div>
          <div className="profile-copy">
            <strong>林先生</strong>
            <span>个人空间</span>
          </div>
          <ChevronDown size={16} />
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <div className="chat-title">
            <div className="assistant-avatar">
              <Bot size={20} />
            </div>
            <div>
              <h1>M4 AI 助手</h1>
              <div className="online-status">
                <span /> 在线
              </div>
            </div>
          </div>
          <div className="header-actions">
            <span className="message-count">{messages.length} 条消息</span>
            <button className="icon-button" type="button" title="更多操作">
              <MoreHorizontal size={20} />
            </button>
          </div>
        </header>

        <div className="message-area">
          {messages.map(message => (
            <article className={`message-row ${message.role}`} key={message.id}>
              {message.role === 'tool' && (
                <div className="tool-card">
                  <div className="tool-card-header">
                    <span className={`tool-status ${message.toolPhase}`} />
                    <strong>{message.toolPhase === 'call' ? '调用工具' : '工具结果'}</strong>
                    <code>工具名字: {message.toolName}</code>
                  </div>
                  <pre style={{ maxHeight: 300, overflow: 'auto' }}> {message.content}</pre>
                  {message.toolPhase === 'call' && message.approvalStatus === 'pending' && (
                    <div className="tool-approval-actions">
                      <button type="button" onClick={() => approveTool(message, true)}>
                        批准执行
                      </button>
                      <button type="button" onClick={() => approveTool(message, false)}>
                        拒绝
                      </button>
                    </div>
                  )}
                  {message.toolPhase === 'call' && message.approvalStatus !== 'pending' && (
                    <div className={`tool-approval-state ${message.approvalStatus}`}>
                      {message.approvalStatus === 'approved' ? '已批准，正在执行' : '已拒绝'}
                    </div>
                  )}
                </div>
              )}
              {message.role === 'assistant' && (
                <div className="message-avatar assistant-avatar">
                  <Bot size={17} />
                </div>
              )}
              {message.role !== 'tool' && (
                <div className="message-content">
                  <div className="message-meta">
                    <span>{message.role === 'assistant' ? 'M4 AI' : '我'}</span>
                    <time>{message.time}</time>
                  </div>
                  <div className="message-bubble">
                    {message.content || (
                      <span className="typing-indicator">
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </div>
                </div>
              )}
              {message.role === 'user' && (
                <div className="message-avatar user-avatar">
                  <User size={17} />
                </div>
              )}
            </article>
          ))}
          {isSending && messages[messages.length - 1]?.role === 'user' && (
            <div className="typing-row">
              <div className="message-avatar assistant-avatar">
                <Bot size={17} />
              </div>
              <span>M4 AI 正在思考...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="composer-wrap sticky bottom-0">
          <form className="composer" onSubmit={sendMessage}>
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder="输入你的问题..."
              rows={1}
              disabled={isSending}
            />
            <div className="composer-actions">
              <button className="send-button" type="submit" disabled={!input.trim() || isSending} title="发送消息">
                {isSending ? <span className="send-loader" /> : <Send size={17} />}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}
