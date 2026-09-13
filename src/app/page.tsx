'use client'

import { observer, useLocalObservable } from 'mobx-react-lite'
import { Settings2 } from 'lucide-react'
import './page.scss'

type ToolState = {
  id: string
  name: string
  args: string
  status: 'pending' | 'running' | 'success' | 'error'
  result?: string
  error?: string
}
type ChatMessage = { id: string; role: 'user' | 'assistant' | 'tool'; content: string; tool?: ToolState }

function formatValue(value: unknown) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function toolStatusLabel(status: ToolState['status']) {
  return { pending: '等待调用', running: '执行中', success: '已完成', error: '失败' }[status]
}

export default observer(function Home() {
  const state = useLocalObservable(() => ({ input: '沈阳和上海天气如何', loading: false, messages: [] as ChatMessage[] }))
  const sendMessage = async () => {
    const text = state.input.trim()
    if (!text || state.loading) return
    state.loading = true
    state.messages.push({ id: `user-${Date.now()}`, role: 'user', content: text })
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      })
      if (!res.body) throw new Error(await res.text())
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let pending = ''
      let finished = false
      const findTool = (id?: string) => state.messages.find(message => message.role === 'tool' && message.tool?.id === id)
      const ensureTool = (id: string, name = '工具') => {
        const existing = findTool(id)
        if (existing?.tool) return existing.tool
        const toolState: ToolState = { id, name, args: '', status: 'pending' }
        state.messages.push({ id: `tool-${id}`, role: 'tool', content: '', tool: toolState })
        return toolState
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
          const payload = JSON.parse(data) as { type: string; [key: string]: any }

          if (payload.type === 'assistant_delta') {
            const isExist = state.messages.some(message => message.id === payload.id)
            if (!isExist) {
              state.messages.push({ id: payload.id, role: 'assistant', content: '' })
            }

            const assistant = state.messages.find(message => message.id === payload.id)
            if (payload.type === 'assistant_delta' && assistant) {
              assistant.content += payload.text ?? ''
            }
          }

          if (payload.type === 'tool_call_start')
            ensureTool(payload.id ?? `unknown-${Date.now()}`, payload.name).name = payload.name || '工具'
          if (payload.type === 'tool_call_args') ensureTool(payload.id ?? `unknown-${Date.now()}`).args += payload.args ?? ''
          if (payload.type === 'tool_start') {
            const toolState = ensureTool(payload.id ?? `unknown-${Date.now()}`, payload.name)
            toolState.name = payload.name || toolState.name
            toolState.status = 'running'
            toolState.args = formatValue(payload.input)
          }
          if (payload.type === 'tool_end') {
            const toolState = ensureTool(payload.id ?? `unknown-${Date.now()}`, payload.name)
            toolState.status = 'success'
            toolState.result = formatValue(payload.output)
          }
          if (payload.type === 'tool_error') {
            const toolState = ensureTool(payload.id ?? `unknown-${Date.now()}`, payload.name)
            toolState.status = 'error'
            toolState.error = formatValue(payload.error)
          }
          if (payload.type === 'error' && assistant) assistant.content = `请求失败：${payload.error}`
          if (payload.type === 'done') finished = true
        }
      }
    } catch (error) {
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
          <span className="status-dot">{state.loading ? '处理中' : '就绪'}</span>
        </header>
        <div className="conversation" aria-live="polite">
          {state.messages.length === 0 && <div className="empty-state">输入问题，查看模型如何调用天气工具。</div>}
          {state.messages.map(message => (
            <article className={`message message-${message.role}`} key={message.id}>
              {message.role !== 'tool' && <div className="message-label">{message.role === 'user' ? '你' : '助手'}</div>}
              {message.role !== 'tool' && (
                <div className="message-content">{message.content || (state.loading ? '正在思考…' : '')}</div>
              )}
              {message.role === 'tool' && message.tool && (
                <div className={`tool-card tool-${message.tool.status}`}>
                  <div className="tool-heading">
                    <Settings2 className="tool-icon" size={16} aria-hidden="true" />
                    <strong>{message.tool.name}</strong>
                    <span className="tool-status">{toolStatusLabel(message.tool.status)}</span>
                  </div>
                  {message.tool.args && <pre>{message.tool.args}</pre>}
                  {message.tool.result && (
                    <div className="tool-result">
                      <span>结果</span>
                      {message.tool.result}
                    </div>
                  )}
                  {message.tool.error && <div className="tool-error">{message.tool.error}</div>}
                </div>
              )}
            </article>
          ))}
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
          <button type="submit" disabled={state.loading || !state.input.trim()}>
            {state.loading ? '执行中…' : '发送'}
          </button>
        </form>
      </section>
    </main>
  )
})
