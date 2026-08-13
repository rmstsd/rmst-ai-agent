import { aiConfig } from '@/config/ai-config'
import { executeTool, loadAiCapabilities } from '@/server/ai-tools'
import type { ChatStreamEvent } from '@/types/ai'

interface ChatSession {
  id: string
  createdAt: number
  lastResponseId?: string
  tools: Record<string, unknown>[]
  /** 当前正在进行的响应，用于停止会话时取消请求。 */
  controller?: AbortController
}

interface ArkEvent {
  type?: string
  code?: string
  message?: string
  delta?: string
  arguments?: string
  response?: { id?: string }
  item?: { type?: string; name?: string; call_id?: string; arguments?: string }
}

interface StreamOptions {
  sessionId: string
  input: unknown[]
  onEvent: (event: ChatStreamEvent) => void
}

const sessions = new Map<string, ChatSession>()

/**
 * 通用大模型配置。
 */
function requireArkConfig() {
  if (!aiConfig.ark.apiKey || !aiConfig.ark.modelId) {
    throw new Error('请先在 src/config/ai-config.ts 中填写 Ark apiKey 和 modelId')
  }
}

function buildHeaders() {
  return {
    Authorization: `Bearer ${aiConfig.ark.apiKey}`,
    'Content-Type': 'application/json'
  }
}

function buildRequestBody(
  input: unknown[],
  tools: Record<string, unknown>[],
  previousResponseId?: string,
  stream = true
) {
  return {
    model: aiConfig.ark.modelId,
    input,
    previous_response_id: previousResponseId,
    // 是否开启上下文缓存，未开启时每次都需要传入 tools。
    // 开启缓存后，首次请求才需要传入工具定义。
    tools: aiConfig.ark.caching && previousResponseId ? undefined : tools,
    thinking: { type: 'disabled' },
    // 是否开启上下文缓存。
    caching: { type: aiConfig.ark.caching ? 'enabled' : 'disabled' },
    stream
  }
}

async function arkFetch(body: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch(`${aiConfig.ark.baseUrl}/responses`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
    signal
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Ark 请求失败（${response.status}）：${detail || response.statusText}`)
  }

  return response
}

function newId() {
  return crypto.randomUUID().replaceAll('-', '')
}

export async function createSession() {
  requireArkConfig()
  const capabilities = await loadAiCapabilities()

  const session: ChatSession = {
    id: newId(),
    createdAt: Date.now(),
    tools: capabilities.tools
  }

  const response = await arkFetch(
    buildRequestBody(
      [{ role: 'system', content: capabilities.systemPrompts.join('|||') }],
      session.tools,
      undefined,
      false
    )
  )
  const result = (await response.json()) as { id?: string }
  if (!result.id) {
    throw new Error('Ark 初始化会话失败：响应中没有 id')
  }

  session.lastResponseId = result.id
  sessions.set(session.id, session)
  return session.id
}

function requireSession(sessionId: string) {
  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error(`会话 ${sessionId} 不存在或已过期`)
  }
  return session
}

export function stopSession(sessionId: string) {
  const session = requireSession(sessionId)
  session.controller?.abort()
  session.controller = undefined
}

function parseSseBlock(block: string) {
  const data = block
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trimStart())
    .join('\n')

  if (!data || data === '[DONE]') return
  return JSON.parse(data) as ArkEvent
}

async function consumeSse(response: Response, session: ChatSession, onEvent: StreamOptions['onEvent']) {
  if (!response.body) throw new Error('Ark 返回了空的流式响应')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let functionName = ''
  let callId = ''

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done }).replaceAll('\r\n', '\n')

    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''

    for (const block of blocks) {
      const event = parseSseBlock(block)
      if (!event) continue

      if (event.type === 'response.created' && event.response?.id) {
        session.lastResponseId = event.response.id
      } else if (event.type === 'response.output_item.added' && event.item?.type === 'function_call') {
        functionName = event.item.name ?? ''
        callId = event.item.call_id ?? ''
      } else if (event.type === 'response.function_call_arguments.done') {
        if (functionName && callId) {
          onEvent({
            type: 'Function',
            name: functionName,
            args: event.arguments,
            callId
          })
        }
      } else if (event.type === 'response.output_text.delta' && event.delta) {
        onEvent({ type: 'Text', text: event.delta })
      } else if (event.type === 'error') {
        onEvent({
          type: 'Error',
          code: event.code,
          message: event.message ?? 'Ark 返回未知错误'
        })
      }
    }

    if (done) break
  }
}

export async function streamChat({ sessionId, input, onEvent }: StreamOptions) {
  requireArkConfig()
  const session = requireSession(sessionId)
  session.controller?.abort()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), aiConfig.ark.timeoutMs)
  session.controller = controller

  try {
    const response = await arkFetch(buildRequestBody(input, session.tools, session.lastResponseId), controller.signal)
    await consumeSse(response, session, onEvent)
    // 成功完成。
    onEvent({ type: 'Done', responseId: session.lastResponseId })
  } finally {
    clearTimeout(timeout)
    if (session.controller === controller) session.controller = undefined
  }
}

export async function streamUserMessage(sessionId: string, message: string, onEvent: StreamOptions['onEvent']) {
  return streamChat({
    sessionId,
    input: [{ role: 'user', content: message }],
    onEvent
  })
}

export async function streamFunctionResult(
  sessionId: string,
  name: string,
  args: string | undefined,
  callId: string,
  onEvent: StreamOptions['onEvent']
) {
  // 原实现中的操作人 op 暂不下传，工具函数只接收模型参数。
  const output = await executeTool(name, args)
  return streamChat({
    sessionId,
    input: [
      { type: 'function_call', call_id: callId, name, arguments: args ?? '{}' },
      { type: 'function_call_output', call_id: callId, output }
    ],
    onEvent
  })
}
