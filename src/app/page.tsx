'use client'

import { Check, X } from 'lucide-react'
import { observer, useLocalObservable } from 'mobx-react-lite'
import type { ChatListResponse, ChatStreamEvent, ToolStatus, UiMessage } from './type'

import './page.scss'

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

function formatValue(value: unknown) {
  if (typeof value === 'string') return value

  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}

function toolStatusLabel(status: ToolStatus) {
  return { pending: '等待调用', approval_required: '待人工审批', running: '执行中', success: '已完成', error: '失败' }[status]
}

export default observer(function Home() {
  const state = useLocalObservable(() => ({
    input: '沈阳和上海天气如何',
    loading: false,

    threadId: 'qwer',
    messages: [] as UiMessage[],

    needApproval: false,

    autoExecute: false
  }))

  // 别删
  console.log(state.messages)

  const consumeStream = async (res: Response) => {
    if (!res.ok) throw new Error(await res.text())
    if (!res.body) throw new Error(await res.text())
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let pending = ''
    let finished = false

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

        const payload = JSON.parse(data) as ChatStreamEvent

        if (payload.type === 'thread') {
          state.threadId = payload.threadId
        }

        if (payload.type === 'ai') {
          const messageId = payload.id
          const messageItem = state.messages.find(item => item.id === messageId)
          if (!messageItem) {
            state.messages.push({ id: messageId, type: 'ai', content: extractText(payload.content) })
          } else {
            messageItem.content = `${messageItem.content ?? ''}${extractText(payload.content)}`
          }
        }

        if (payload.type === 'approval_required') {
          state.needApproval = true

          if (payload.toolCalls.length > 0) {
            state.messages.push({
              type: 'tool',
              id: payload.id,
              toolCalls: payload.toolCalls.map(toolCall => ({
                ...toolCall,
                status: 'approval_required'
              }))
            })
          }
        }

        const findToolItem = (toolCallId: string) => {
          let toolAnsItem
          for (const msgItem of state.messages) {
            if (msgItem.type !== 'tool') continue

            for (const toolItem of msgItem.toolCalls ?? []) {
              if (toolItem.id === toolCallId) {
                toolAnsItem = toolItem
                break
              }
            }
          }

          return toolAnsItem
        }

        if (payload.type === 'tool_start') {
          const toolAnsItem = findToolItem(payload.id)
          if (toolAnsItem) toolAnsItem.status = 'running'
        }
        if (payload.type === 'tool_end') {
          const toolAnsItem = findToolItem(payload.id)
          if (toolAnsItem) {
            toolAnsItem.status = 'success'
            toolAnsItem.content = formatValue(payload.output)
          }
        }

        if (payload.type === 'error') {
          state.messages.push({
            id: `error-${Date.now()}`,
            type: 'ai',
            content: `请求失败：${formatValue(payload.error)}`
          })
        }

        if (payload.type === 'done') {
          finished = true
        }
      }
    }
  }

  const sendMessage = async () => {
    const text = state.input.trim()
    if (!text || state.loading || state.needApproval) return
    state.loading = true

    state.messages.push({ id: `user-${Date.now()}`, type: 'user', content: text })
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, threadId: state.threadId })
      })
      await consumeStream(res)
    } finally {
      state.loading = false
    }
  }

  const resolveApproval = async (approved: boolean) => {
    if (state.loading) return

    state.needApproval = false
    state.loading = true
    for (const message of state.messages) {
      for (const toolCall of message.toolCalls ?? []) {
        if (toolCall.status !== 'approval_required') continue

        toolCall.status = approved ? 'running' : 'error'
        if (!approved) toolCall.error = '工具调用已被人工拒绝'
      }
    }

    try {
      const res = await fetch('/api/chat/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: state.threadId, approved })
      })
      await consumeStream(res)
    } finally {
      state.loading = false
    }
  }

  const restoreMessages = async () => {
    if (!state.threadId.trim() || state.loading) return

    state.loading = true
    try {
      const res = await fetch('/api/chat/getList', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: state.threadId })
      })
      if (!res.ok) throw new Error(await res.text())

      const data = (await res.json()) as ChatListResponse
      state.messages = data.messages
      state.needApproval = data.needApproval
    } finally {
      state.loading = false
    }
  }

  return (
    <main className="chat-page">
      <section className="chat-shell">
        <header className="chat-header">
          <div className="flex gap-2">
            <button onClick={restoreMessages} disabled={state.loading}>
              恢复会话
            </button>
            <button
              onClick={() => {
                state.threadId = crypto.randomUUID()
                state.messages = []
                state.needApproval = false
              }}
              disabled={state.loading}
            >
              新会话
            </button>

            <button
              onClick={() => {
                state.autoExecute = !state.autoExecute
                fetch('/api/chat/autoExecute', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ autoExecute: state.autoExecute })
                })
              }}
            >
              自动执行 ({String(state.autoExecute)})
            </button>
          </div>
        </header>
        <div className="conversation">
          {state.messages.map(message => {
            const role = message.type === 'user' ? 'user' : message.type === 'ai' ? 'assistant' : 'tool'

            return (
              <article className={`message message-${role}`} key={message.id}>
                {message.type !== 'tool' && <div className="message-label">{message.type === 'user' ? '你' : '助手'}</div>}
                {message.type !== 'tool' && (
                  <div className="message-content">{message.content || (state.loading ? '正在思考…' : '')}</div>
                )}

                {message.type === 'tool' &&
                  message.toolCalls?.map(item => {
                    const toolStatus = item.status ?? 'pending'

                    return (
                      <div className={`tool-card tool-${toolStatus}`} key={item.id}>
                        <div className="tool-heading">
                          <strong>{item.name}</strong>
                          <span className="tool-status">{toolStatusLabel(toolStatus)}</span>
                        </div>
                        {item.args ? <pre>{JSON.stringify(item.args)}</pre> : null}
                        {toolStatus === 'success' && (
                          <div className="tool-result">
                            <span>结果</span>
                            {item.content}
                          </div>
                        )}
                        {item.error ? <div className="tool-error">{formatValue(item.error)}</div> : null}
                      </div>
                    )
                  })}
              </article>
            )
          })}
        </div>

        {state.needApproval ? (
          <div className="tool-actions">
            <button type="button" onClick={() => resolveApproval(true)} disabled={state.loading}>
              <Check size={15} />
              批准执行
            </button>
            <button type="button" onClick={() => resolveApproval(false)} disabled={state.loading}>
              <X size={15} />
              拒绝
            </button>
          </div>
        ) : null}
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
          <button type="submit" disabled={state.loading || state.needApproval || !state.input.trim()}>
            {state.loading ? '执行中…' : '发送'}
          </button>
        </form>
      </section>
    </main>
  )
})
