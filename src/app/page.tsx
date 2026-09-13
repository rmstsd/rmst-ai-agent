'use client'

import { Check, X } from 'lucide-react'
import { observer, useLocalObservable } from 'mobx-react-lite'
import './page.scss'
import { UiMessage } from './type'

type ToolStatus = NonNullable<UiMessage['status']>
type SSEPayload = {
  type: string
  data?: unknown
  id?: unknown
  threadId?: unknown
  interruptId?: unknown
  name?: string
  args?: string
  input?: unknown
  output?: unknown
  error?: unknown
  approved?: unknown
  toolCalls?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function formatValue(value: unknown) {
  if (typeof value === 'string') return value
  try {
    const formatted = JSON.stringify(value, null, 2)
    return formatted === undefined ? String(value) : formatted
  } catch {
    return String(value)
  }
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map(part => {
      if (typeof part === 'string') return part
      if (!part || typeof part !== 'object') return ''
      const text = (part as { text?: unknown }).text
      return typeof text === 'string' ? text : ''
    })
    .join('')
}

function extractToolCalls(value: unknown): UiMessage['tool_calls'] {
  if (!Array.isArray(value)) return undefined
  const toolCalls = value.filter(isRecord).map(toolCall => ({
    id: typeof toolCall.id === 'string' ? toolCall.id : '',
    name: typeof toolCall.name === 'string' ? toolCall.name : '',
    args: typeof toolCall.args === 'string' ? toolCall.args : toolCall.args == null ? '' : formatValue(toolCall.args)
  }))
  return toolCalls.length > 0 ? toolCalls : undefined
}

function toolStatusLabel(status: ToolStatus) {
  return { pending: '等待调用', approval_required: '待人工审批', running: '执行中', success: '已完成', error: '失败' }[status]
}

export default observer(function Home() {
  const state = useLocalObservable(() => ({
    input: '沈阳和上海天气如何',
    loading: false,
    threadId: undefined as string | undefined,
    approval: null as { interruptId?: string; toolIds: string[] } | null,
    messages: [] as UiMessage[]
  }))

  // 别删
  console.log(state.messages)

  const consumeStream = async (res: Response) => {
    if (!res.body) throw new Error(await res.text())
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let pending = ''
    let finished = false
    let currentAssistantId: string | undefined
    const findTool = (id?: string) => state.messages.find(message => message.type === 'tool' && message.tool_call_id === id)
    const ensureTool = (id: string, name = '工具') => {
      const existing = findTool(id)
      if (existing) return existing
      const message: UiMessage = { id: id, type: 'tool', content: '', tool_call_id: id, name, args: '', status: 'pending' }
      state.messages.push(message)
      return state.messages[state.messages.length - 1]
    }

    while (!finished) {
      const { done, value } = await reader.read()
      if (done) break
      pending += decoder.decode(value, { stream: true })
      const events = pending.split('\n\n')
      pending = events.pop() ?? ''
      for (const event of events) {
        const data = event
          .split('\n')
          .find(line => line.startsWith('data:'))
          ?.slice(5)
          .trim()
        if (!data || data === '[DONE]') continue
        const payload = JSON.parse(data) as SSEPayload

        if (payload.type === 'thread' && typeof payload.threadId === 'string') {
          state.threadId = payload.threadId
        }
        if (payload.type === 'ai') {
          const chunkData = isRecord(payload.data) ? payload.data : {}
          const chunkId = typeof chunkData.id === 'string' ? chunkData.id : undefined
          const messageId = currentAssistantId ?? chunkId ?? `assistant-${Date.now()}`
          const chunkToolCalls = extractToolCalls(chunkData.tool_calls)
          if (!currentAssistantId) {
            currentAssistantId = messageId
            state.messages.push({
              id: messageId,
              type: 'ai',
              content: extractText(chunkData.content),
              ...(chunkToolCalls ? { tool_calls: chunkToolCalls } : {})
            })
          } else {
            const assistant = state.messages.find(message => message.type === 'ai' && message.id === currentAssistantId)
            if (assistant) {
              assistant.content += extractText(chunkData.content)
              if (chunkToolCalls) assistant.tool_calls = chunkToolCalls
            }
          }
        }
        if (payload.type === 'tool_call_start') {
          const toolData = ensureTool(String(payload.id ?? `unknown-${Date.now()}`), payload.name)
          toolData.name = payload.name || '工具'
        }
        if (payload.type === 'tool_call_args') {
          const toolData = ensureTool(String(payload.id ?? `unknown-${Date.now()}`))
          toolData.args = `${toolData.args ?? ''}${payload.args ?? ''}`
        }
        if (payload.type === 'tool_start') {
          const toolData = ensureTool(String(payload.id ?? `unknown-${Date.now()}`), payload.name)
          toolData.name = payload.name || toolData.name
          toolData.status = 'running'
          toolData.input = payload.input
          toolData.args = formatValue(payload.input)
        }
        if (payload.type === 'tool_end') {
          const toolData = ensureTool(String(payload.id ?? `unknown-${Date.now()}`), payload.name)
          toolData.status = 'success'
          toolData.content = formatValue(payload.output)
          currentAssistantId = undefined
        }
        if (payload.type === 'tool_error') {
          const toolData = ensureTool(String(payload.id ?? `unknown-${Date.now()}`), payload.name)
          toolData.status = 'error'
          toolData.error = payload.error
          currentAssistantId = undefined
        }
        if (payload.type === 'approval_required') {
          currentAssistantId = undefined
          const calls = Array.isArray(payload.toolCalls) ? payload.toolCalls : []
          const toolIds: string[] = []
          for (const value of calls) {
            if (!isRecord(value)) continue
            const id = typeof value.id === 'string' ? value.id : ''
            if (!id) continue
            const toolData = ensureTool(id, typeof value.name === 'string' ? value.name : '工具')
            toolData.name = typeof value.name === 'string' ? value.name : toolData.name
            toolData.args = formatValue(value.args)
            toolData.input = value.args
            toolData.status = 'approval_required'
            toolIds.push(id)
          }
          if (toolIds.length > 0) {
            state.approval = {
              interruptId: typeof payload.interruptId === 'string' ? payload.interruptId : undefined,
              toolIds
            }
          }
        }
        if (payload.type === 'approval_resolved') {
          currentAssistantId = undefined
          const approved = payload.approved === true
          const approval = state.approval
          if (approval) {
            approval.toolIds.forEach(id => {
              const toolData = findTool(id)
              if (toolData) {
                toolData.status = approved ? 'running' : 'error'
                if (!approved) toolData.error = '工具调用已被人工拒绝'
              }
            })
            state.approval = null
          }
        }
        if (payload.type === 'error') {
          const assistant = currentAssistantId
            ? state.messages.find(message => message.type === 'ai' && message.id === currentAssistantId)
            : undefined
          if (assistant) assistant.content = `请求失败：${formatValue(payload.error)}`
          else {
            currentAssistantId = `assistant-${Date.now()}`
            state.messages.push({
              id: currentAssistantId,
              type: 'ai',
              content: `请求失败：${formatValue(payload.error)}`
            })
          }
        }
        if (payload.type === 'done') finished = true
      }
    }
  }

  const sendMessage = async () => {
    const text = state.input.trim()
    if (!text || state.loading || state.approval) return
    state.loading = true
    state.messages.push({ id: `user-${Date.now()}`, type: 'user', content: text })
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, threadId: state.threadId })
      })
      await consumeStream(res)
    } catch (error) {
      state.messages.push({
        id: `assistant-${Date.now()}`,
        type: 'ai',
        content: `请求失败：${error instanceof Error ? error.message : '请求失败'}`
      })
    } finally {
      state.loading = false
    }
  }

  const resolveApproval = async (approved: boolean) => {
    const approval = state.approval
    if (!approval || !state.threadId || state.loading) return
    state.loading = true
    try {
      const res = await fetch('/api/chat/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: state.threadId, approved })
      })
      await consumeStream(res)
    } catch (error) {
      approval.toolIds.forEach(id => {
        const toolData = state.messages.find(message => message.type === 'tool' && message.tool_call_id === id)
        if (toolData) {
          toolData.status = 'error'
          toolData.error = error instanceof Error ? error.message : '审批请求失败'
        }
      })
      state.approval = null
    } finally {
      state.loading = false
    }
  }

  return (
    <main className="chat-page">
      <section className="chat-shell" aria-label="AI 对话">
        <header className="chat-header">
          <div>
            <p className="eyebrow">M4 AI AGENT</p>
            <h1>实时工具调用</h1>
          </div>
          <span className="status-dot">{state.loading ? '处理中' : state.approval ? '等待审批' : '就绪'}</span>
        </header>
        <div className="conversation" aria-live="polite">
          {state.messages.length === 0 && <div className="empty-state">输入问题，查看模型如何调用天气工具。</div>}
          {state.messages.map(message => {
            const role = message.type === 'user' ? 'user' : message.type === 'ai' ? 'assistant' : 'tool'
            const toolStatus = message.status ?? 'pending'
            return (
              <article className={`message message-${role}`} key={message.id}>
                {message.type !== 'tool' && <div className="message-label">{message.type === 'user' ? '你' : '助手'}</div>}
                {message.type !== 'tool' && (
                  <div className="message-content">{message.content || (state.loading ? '正在思考…' : '')}</div>
                )}
                {message.type === 'tool' && (
                  <div className={`tool-card tool-${toolStatus}`}>
                    <div className="tool-heading">
                      <strong>{message.name}</strong>
                      <span className="tool-status">{toolStatusLabel(toolStatus)}</span>
                    </div>
                    {message.args ? <pre>{message.args}</pre> : null}
                    {toolStatus === 'success' && (
                      <div className="tool-result">
                        <span>结果</span>
                        {message.content}
                      </div>
                    )}
                    {message.error ? <div className="tool-error">{formatValue(message.error)}</div> : null}
                    {message.status === 'approval_required' && state.approval?.toolIds[0] === message.tool_call_id && (
                      <div className="tool-actions">
                        <button type="button" onClick={() => resolveApproval(true)} disabled={state.loading}>
                          <Check size={15} aria-hidden="true" />
                          批准执行
                        </button>
                        <button type="button" onClick={() => resolveApproval(false)} disabled={state.loading}>
                          <X size={15} aria-hidden="true" />
                          拒绝
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
        <form
          className="composer"
          onSubmit={event => {
            event.preventDefault()
            sendMessage()
          }}
        >
          <label htmlFor="message">消息</label>
          <textarea
            id="message"
            value={state.input}
            onChange={event => {
              state.input = event.target.value
            }}
            rows={2}
          />
          <button type="submit" disabled={state.loading || Boolean(state.approval) || !state.input.trim()}>
            {state.loading ? '执行中…' : '发送'}
          </button>
        </form>
      </section>
    </main>
  )
})
