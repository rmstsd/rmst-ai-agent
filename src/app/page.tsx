'use client'

import { Check, X } from 'lucide-react'
import { observer, useLocalObservable } from 'mobx-react-lite'
import { UiMessage } from './type'

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

function toolStatusLabel(status) {
  return { pending: '等待调用', approval_required: '待人工审批', running: '执行中', success: '已完成', error: '失败' }[status]
}

export default observer(function Home() {
  const state = useLocalObservable(() => ({
    input: '沈阳和上海天气如何',
    loading: false,

    threadId: 'aaabsy',
    messages: [] as UiMessage[],

    needApproval: false
  }))

  // 别删
  console.log(state.messages)

  const consumeStream = async (res: Response) => {
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

        const payload = JSON.parse(data) as UiMessage

        if (payload.type === 'ai') {
          const messageId = payload.id
          const messageItem = state.messages.find(item => item.id === messageId)
          if (!messageItem) {
            state.messages.push({ id: messageId, type: 'ai', content: extractText(payload.content) })
          } else {
            messageItem.content += extractText(payload.content)
          }
        }

        if (payload.type === 'approval_required') {
          state.needApproval = true

          if (payload.toolCalls && Array.isArray(payload.toolCalls) && payload.toolCalls.length > 0) {
            state.messages.push({
              type: 'tool',
              id: payload.id,
              toolCalls: payload.toolCalls
            })
          }
        }

        const findToolItem = () => {
          let toolAnsItem
          for (const msgItem of state.messages) {
            if (msgItem.type !== 'tool') continue

            for (const toolItem of msgItem.toolCalls) {
              if (toolItem.id === payload.id) {
                toolAnsItem = toolItem
                break
              }
            }
          }

          return toolAnsItem
        }

        if (payload.type === 'tool_start') {
          const toolAnsItem = findToolItem()
          toolAnsItem.status = 'running'
        }
        if (payload.type === 'tool_end') {
          const toolAnsItem = findToolItem()
          toolAnsItem.status = 'success'
          toolAnsItem.content = JSON.stringify(payload.output)
        }

        if (payload.type === 'done') {
          finished = true
        }
      }
    }
  }

  const sendMessage = async () => {
    const text = state.input.trim()
    if (!text || state.loading) return
    state.loading = true

    state.threadId = `thread-${Date.now()}`
    state.messages.push({ id: `user-${Date.now()}`, type: 'user', content: text })
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, threadId: state.threadId })
    })
    await consumeStream(res)

    state.loading = false
  }

  const resolveApproval = async (approved: boolean) => {
    state.needApproval = false

    const res = await fetch('/api/chat/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: state.threadId, approved })
    })
    await consumeStream(res)
  }

  return (
    <main className="chat-page">
      <section className="chat-shell">
        <header className="chat-header">
          <div>
            <button
              type="button"
              onClick={() => fetch('/api/chat/getList', { body: JSON.stringify({ threadId: state.threadId }), method: 'POST' })}
            >
              get state
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
                      </div>
                    )
                  })}
              </article>
            )
          })}
        </div>
        <div></div>
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
          <button type="submit" disabled={state.loading || !state.input.trim()}>
            {state.loading ? '执行中…' : '发送'}
          </button>
        </form>
      </section>
    </main>
  )
})
