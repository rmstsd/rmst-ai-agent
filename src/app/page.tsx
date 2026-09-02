'use client'

import { getConversationHistory, sendApproval, sendMessage, stopMessage } from '@/api/ai-api'
import type { ChatMessage, ChatStreamEvent, ChatToolCall, LangChainHistoryMessage, PendingApproval } from '@/types/ai'
import { Bot, CircleStop, Send, ShieldCheck, UserRound, X } from 'lucide-react'
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
  return [welcomeMessage, ...messages]
}

function appendDelta(current: string, next: string) {
  if (!current) return next
  if (!next || next.startsWith(current)) return next || current
  const maxOverlap = Math.min(current.length, next.length)
  for (let size = maxOverlap; size > 0; size -= 1) {
    if (current.endsWith(next.slice(0, size))) return current + next.slice(size)
  }
  return current + next
}

function contentToParts(content: unknown) {
  const parts = { text: '', reasoning: '' }
  const items = Array.isArray(content) ? content : [content]
  for (const item of items) {
    if (typeof item === 'string') {
      parts.text += item
      continue
    }
    if (!item || typeof item !== 'object') continue
    const value = item as {
      type?: unknown
      text?: unknown
      reasoning?: unknown
      reasoning_content?: unknown
      content?: unknown
      summary?: unknown
    }
    const type = typeof value.type === 'string' ? value.type.toLowerCase() : ''
    const isReasoning = ['analysis', 'reasoning', 'reasoning_content', 'thinking', 'thought'].includes(type)
    const summaryParts = isReasoning && Array.isArray(value.summary) ? contentToParts(value.summary) : undefined
    const reasoning =
      typeof value.reasoning === 'string'
        ? value.reasoning
        : typeof value.reasoning_content === 'string'
          ? value.reasoning_content
          : summaryParts?.reasoning || summaryParts?.text || ''
    const text = typeof value.text === 'string' ? value.text : typeof value.content === 'string' ? value.content : ''
    if (reasoning) parts.reasoning += reasoning
    if (text) {
      if (isReasoning) parts.reasoning += text
      else parts.text += text
    }
  }
  return parts
}

function stringify(value: unknown) {
  if (value === undefined) return undefined
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function reasoningToText(value: unknown) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  const summary = (value as { summary?: unknown }).summary
  if (!Array.isArray(summary)) return ''
  return summary
    .map(item => (item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string' ? (item as { text: string }).text : ''))
    .filter(Boolean)
    .join('\n')
}

function historyToMessages(history: LangChainHistoryMessage[]): ChatMessage[] {
  const messages: ChatMessage[] = []
  for (const [index, stored] of history.entries()) {
    const data = stored.data
    const parts = contentToParts(data.content)
    const additional = data.additional_kwargs as Record<string, unknown> | undefined
    const metadata = data.response_metadata as Record<string, unknown> | undefined
    const responseCreatedAt = metadata?.created_at
    const createdAt =
      typeof additional?.createdAt === 'number'
        ? additional.createdAt
        : typeof responseCreatedAt === 'number'
          ? responseCreatedAt < 10_000_000_000
            ? responseCreatedAt * 1000
            : responseCreatedAt
          : Date.now()
    const id = typeof data.id === 'string' ? data.id : `history-${index}`

    if (stored.type === 'human') {
      messages.push({ id, role: 'user', content: parts.text || parts.reasoning, createdAt, status: 'done' })
      continue
    }

    if (stored.type === 'ai') {
      const toolCalls = Array.isArray(data.tool_calls)
        ? data.tool_calls.flatMap(call => {
            if (!call || typeof call !== 'object') return []
            const value = call as { id?: unknown; name?: unknown; args?: unknown }
            if (typeof value.name !== 'string') return []
            return [
              {
                id: typeof value.id === 'string' ? value.id : `${value.name}-${index}`,
                name: value.name,
                args: stringify(value.args),
                status: 'success' as const
              }
            ]
          })
        : []
      const reasoning = parts.reasoning || reasoningToText(additional?.reasoning) || reasoningToText(additional?.reasoning_content)
      messages.push({ id, role: 'assistant', content: parts.text, reasoning: reasoning || undefined, toolCalls, createdAt, status: 'done' })
      continue
    }

    if (stored.type === 'tool') {
      const assistant = messages.at(-1)
      const toolCallId = typeof data.tool_call_id === 'string' ? data.tool_call_id : `tool-output-${index}`
      const call = assistant?.role === 'assistant' ? assistant.toolCalls?.find(item => item.id === toolCallId) : undefined
      const status = data.status === 'error' ? 'error' : 'success'
      if (call) {
        call.output = parts.text || parts.reasoning || stringify(data.content) || '无'
        call.status = status
      } else if (assistant?.role === 'assistant') {
        assistant.toolCalls = [
          ...(assistant.toolCalls ?? []),
          {
            id: toolCallId,
            name: typeof data.name === 'string' ? data.name : 'tool',
            output: parts.text || parts.reasoning || '无',
            status
          }
        ]
      }
    }
  }
  return messages
}

function updateToolCall(toolCalls: ChatToolCall[] | undefined, callId: string, update: Partial<ChatToolCall>) {
  const nextToolCalls = [...(toolCalls ?? [])]
  let index = nextToolCalls.findIndex(call => call.id === callId)
  if (index === -1 && update.name) {
    index = nextToolCalls.findLastIndex(call => {
      if (call.name !== update.name || (call.output !== undefined && call.status !== 'error')) return false
      return update.args === undefined || call.args === update.args
    })
  }
  if (index === -1) {
    nextToolCalls.push({ id: callId, name: update.name ?? 'tool', ...update })
    return nextToolCalls
  }
  nextToolCalls[index] = { ...nextToolCalls[index], ...update }
  return nextToolCalls
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
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage])
  const [pendingApproval, setPendingApproval] = useState<PendingApproval>()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)
  const assistantMessageIdRef = useRef('')
  const assistantModelStartedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    initializeSession()
  }, [])

  useEffect(() => {
    const element = messagesRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages])

  async function initializeSession() {
    setInitializing(true)
    setError('')
    let nextSessionId = crypto.randomUUID()
    try {
      const raw = localStorage.getItem(sessionStorageKey)
      nextSessionId = raw || nextSessionId
      if (!raw) localStorage.setItem(sessionStorageKey, nextSessionId)
    } catch {
      // localStorage 不可用时仍使用本次页面生成的会话 ID。
    }

    setSessionId(nextSessionId)
    try {
      const history = await getConversationHistory(nextSessionId)
      setMessages(withWelcome(historyToMessages(history.messages)))
      setPendingApproval(history.pendingApproval)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setInitializing(false)
    }
  }

  function updateAssistantMessage(id: string, event: ChatStreamEvent) {
    if (event.type === 'MessageStart') {
      if (!assistantModelStartedRef.current) {
        assistantModelStartedRef.current = true
        return
      }
      const activeId = assistantMessageIdRef.current || id
      const nextMessage = createMessage('assistant', '')
      assistantMessageIdRef.current = nextMessage.id
      setMessages(current => current.map(message => (message.id === activeId ? { ...message, status: 'done' as const } : message)).concat(nextMessage))
      return
    }

    const activeId = assistantMessageIdRef.current || id
    if (event.type === 'Approval') setPendingApproval(event.approval)
    if (event.type === 'Error') setError(event.message)

    setMessages(current =>
      current.map(message => {
        if (message.id !== activeId) return message
        if (event.type === 'Text') return { ...message, content: appendDelta(message.content, event.text) }
        if (event.type === 'Reasoning') return { ...message, reasoning: appendDelta(message.reasoning ?? '', event.text) }
        if (event.type === 'Function')
          return {
            ...message,
            toolCalls: updateToolCall(message.toolCalls, event.callId, {
              name: event.name,
              args: event.args,
              output: undefined,
              status: undefined
            })
          }
        if (event.type === 'FunctionResult')
          return {
            ...message,
            toolCalls: updateToolCall(message.toolCalls, event.callId, {
              name: event.name,
              output: event.output ?? '无',
              status: event.status ?? 'success'
            })
          }
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
    assistantModelStartedRef.current = false
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

  async function approvePending(approved: boolean) {
    if (!pendingApproval || !sessionId || loading) return
    assistantModelStartedRef.current = Boolean(assistantMessageIdRef.current)
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
      <aside className="chat-sidebar" hidden>
        <div className="brand">
          <span className="brand-mark">
            <ShieldCheck size={19} />
          </span>
          <div>
            <strong>Deep Agent</strong>
            <span>LangGraph runtime</span>
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
            <button
              onClick={() => {
                localStorage.clear()
                location.reload()
              }}
            >
              新建
            </button>
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
                  <span>{formatMessageDate(message.createdAt)}</span>
                </div>
                {message.role === 'assistant' && message.reasoning && (
                  <section className="message-reasoning">
                    <span>思考过程</span>
                    <div>{message.reasoning}</div>
                  </section>
                )}
                {message.role === 'assistant' && message.toolCalls?.length ? (
                  <section className="message-tools">
                    {message.toolCalls.map(toolCall => (
                      <article className="message-tool" key={toolCall.id}>
                        <div className="message-tool-header">
                          <strong>{toolCall.name}</strong>
                          <span>{toolCall.output === undefined ? '执行中' : toolCall.status === 'error' ? '失败' : '已完成'}</span>
                        </div>
                        {toolCall.args && (
                          <pre>
                            <b>输入</b>
                            {toolCall.args}
                          </pre>
                        )}
                        {toolCall.output !== undefined && (
                          <pre>
                            <b>输出</b>
                            {toolCall.output}
                          </pre>
                        )}
                      </article>
                    ))}
                  </section>
                ) : null}
                {(message.content || !message.reasoning) && (
                  <div
                    className={`message-content ${message.role === 'assistant' ? 'assistant-response' : ''} ${message.status === 'error' ? 'error' : ''}`}
                  >
                    {message.content || (
                      <span className="typing-indicator">
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </div>
                )}
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
              placeholder={initializing ? '正在初始化会话...' : pendingApproval ? '请先处理待审批操作' : '输入你的问题'}
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
