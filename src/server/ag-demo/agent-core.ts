import { aiConfig } from '@/config/ai-config'
import { createApprovalId, executeToolCall, ToolCall, toolsList } from './tool'

type ArkResponseInput = { role: 'user'; content: string } | { type: 'function_call_output'; call_id: string; output: string }

type ExecutedToolCall = {
  call: ToolCall
  output: string
  input: ArkResponseInput
}

type PendingApproval = {
  sessionId: string
  toolCall: ToolCall
  resolve: (approved: boolean) => void
  timer: ReturnType<typeof setTimeout>
}

export type AgentConversationRequest = {
  sessionId: string
  message: string
  signal?: AbortSignal
}

const sessionMap = new Map<string, { sessionId: string; previousResponseId: string }>()

const approvalMap = new Map<string, PendingApproval>()

export class AgentCoreError extends Error {
  readonly status: number

  constructor(message: string, status = 502) {
    super(message)
    this.name = 'AgentCoreError'
    this.status = status
  }
}

const streamHeaders = {
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'Content-Type': 'text/event-stream; charset=utf-8',
  'X-Accel-Buffering': 'no'
}

function getResponseId(payload: unknown) {
  if (typeof payload !== 'object' || payload === null) {
    return undefined
  }

  const event = payload as {
    response?: { id?: unknown }
    previousResponseId?: unknown
    previous_response_id?: unknown
  }

  const responseId = event.response?.id ?? event.previousResponseId ?? event.previous_response_id

  return typeof responseId === 'string' && responseId.trim().length > 0 ? responseId : undefined
}

function getToolCallFromItem(item: unknown): Partial<ToolCall> | undefined {
  if (typeof item !== 'object' || item === null) {
    return undefined
  }

  const value = item as {
    type?: unknown
    id?: unknown
    call_id?: unknown
    name?: unknown
    arguments?: unknown
  }

  if (value.type !== 'function_call') {
    return undefined
  }

  return {
    itemId: typeof value.id === 'string' ? value.id : undefined,
    callId: typeof value.call_id === 'string' ? value.call_id : undefined,
    name: typeof value.name === 'string' ? value.name : undefined,
    arguments: typeof value.arguments === 'string' ? value.arguments : undefined
  }
}

function updateToolCall(toolCalls: Map<string, ToolCall>, value: Partial<ToolCall>) {
  const key = value.callId || value.itemId
  if (!key) {
    return
  }

  const existingEntry = [...toolCalls.entries()].find(
    ([entryKey, item]) =>
      entryKey === key || (value.itemId && item.itemId === value.itemId) || (value.callId && item.callId === value.callId)
  )
  const current = existingEntry?.[1]
  const mapKey = existingEntry?.[0] || key

  toolCalls.set(mapKey, {
    callId: value.callId || current?.callId || key,
    itemId: value.itemId || current?.itemId,
    name: value.name || current?.name || '',
    arguments: value.arguments ?? current?.arguments ?? ''
  })
}

function collectToolCalls(payload: unknown, toolCalls: Map<string, ToolCall>) {
  if (typeof payload !== 'object' || payload === null) {
    return
  }

  const event = payload as {
    type?: unknown
    item?: unknown
    response?: { output?: unknown }
    item_id?: unknown
    call_id?: unknown
    name?: unknown
    delta?: unknown
    arguments?: unknown
  }

  const eventType = typeof event.type === 'string' ? event.type : ''
  if (eventType === 'response.output_item.added' || eventType === 'response.output_item.done') {
    updateToolCall(toolCalls, getToolCallFromItem(event.item) || {})
  }

  if (eventType === 'response.function_call_arguments.delta' && typeof event.delta === 'string') {
    const key = typeof event.call_id === 'string' ? event.call_id : event.item_id
    if (typeof key === 'string') {
      const current = toolCalls.get(key)
      updateToolCall(toolCalls, {
        callId: current?.callId || (typeof event.call_id === 'string' ? event.call_id : undefined),
        itemId: current?.itemId || (typeof event.item_id === 'string' ? event.item_id : undefined),
        name: current?.name || '',
        arguments: `${current?.arguments || ''}${event.delta}`
      })
    }
  }

  if (eventType === 'response.function_call_arguments.done') {
    updateToolCall(toolCalls, {
      callId: typeof event.call_id === 'string' ? event.call_id : undefined,
      itemId: typeof event.item_id === 'string' ? event.item_id : undefined,
      name: typeof event.name === 'string' ? event.name : undefined,
      arguments: typeof event.arguments === 'string' ? event.arguments : undefined
    })
  }

  if (Array.isArray(event.response?.output)) {
    for (const item of event.response.output) {
      updateToolCall(toolCalls, getToolCallFromItem(item) || {})
    }
  }
}

function parseResponseEvents(buffer: string, toolCalls: Map<string, ToolCall>) {
  const frames = buffer.split(/\r?\n\r?\n/)
  const remaining = frames.pop() || ''
  let responseId: string | undefined

  for (const frame of frames) {
    const data = frame
      .split(/\r?\n/)
      .find(line => line.startsWith('data:'))
      ?.slice(5)
      .trim()

    if (!data || data === '[DONE]') {
      continue
    }

    try {
      const payload = JSON.parse(data)
      responseId = getResponseId(payload) || responseId
      collectToolCalls(payload, toolCalls)
    } catch {
      // SSE 数据可能跨 chunk 到达，未完成的 JSON 留到下一个 chunk 继续解析。
    }
  }

  return { responseId, remaining }
}

const maxToolRounds = 5

function waitForToolApproval(sessionId: string, toolCall: ToolCall, approvalId: string, signal: AbortSignal) {
  return new Promise<boolean>(resolve => {
    const timer = setTimeout(() => {
      approvalMap.delete(approvalId)
      resolve(false)
    }, 5 * 60_000)

    approvalMap.set(approvalId, { sessionId, toolCall, resolve, timer })

    const cancel = () => {
      const pending = approvalMap.get(approvalId)
      if (!pending) return
      clearTimeout(pending.timer)
      approvalMap.delete(approvalId)
      resolve(false)
    }
    signal.addEventListener('abort', cancel, { once: true })
  })
}

export function resolveToolApproval(sessionId: string, approvalId: string, approved: boolean) {
  const pending = approvalMap.get(approvalId)
  if (!pending || pending.sessionId !== sessionId) {
    return false
  }

  clearTimeout(pending.timer)
  approvalMap.delete(approvalId)
  pending.resolve(approved)
  return true
}

function getArkRequestBody(
  { sessionId, message }: AgentConversationRequest,
  input?: ArkResponseInput[],
  previousResponseId?: string
) {
  const requestInput = input || [{ role: 'user', content: message }]

  const session = sessionMap.get(sessionId)

  return {
    model: aiConfig.ark.modelId,
    previous_response_id: previousResponseId || session?.previousResponseId || undefined,
    input: requestInput,
    thinking: { type: 'disabled' },
    caching: { type: aiConfig.ark.caching ? 'enabled' : 'disabled' },
    stream: true,
    tools: toolsList
  }
}

async function requestArkResponse(
  request: AgentConversationRequest,
  signal: AbortSignal,
  input?: ArkResponseInput[],
  previousResponseId?: string
) {
  const response = await fetch(`${aiConfig.ark.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${aiConfig.ark.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    },
    body: JSON.stringify(getArkRequestBody(request, input, previousResponseId)),
    signal,
    cache: 'no-store'
  })

  if (!response.ok) {
    const details = await response.text()
    throw new AgentCoreError(details || `Ark 请求失败（HTTP ${response.status}）`, response.status)
  }

  if (!response.body) {
    throw new AgentCoreError('Ark 未返回可读取的流')
  }

  return response
}

function forwardStream(
  body: ReadableStream<Uint8Array>,
  cleanup: () => void,
  request: AgentConversationRequest,
  signal: AbortSignal
) {
  let reader = body.getReader()
  let decoder = new TextDecoder()
  let eventBuffer = ''
  let responseId: string | undefined
  let toolCalls = new Map<string, ToolCall>()
  let toolRound = 0

  const saveSession = () => {
    if (responseId) {
      sessionMap.set(request.sessionId, { sessionId: request.sessionId, previousResponseId: responseId })
    }
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read()
        console.log('result.done', result.done)
        if (!result.done) {
          const value = decoder.decode(result.value, { stream: true })
          eventBuffer += value
          const parsed = parseResponseEvents(eventBuffer, toolCalls)
          eventBuffer = parsed.remaining
          responseId = parsed.responseId || responseId
          controller.enqueue(result.value)
          return
        }

        console.log('eventBuffer', eventBuffer)
        eventBuffer += decoder.decode()
        const parsed = parseResponseEvents(`${eventBuffer}\n\n`, toolCalls)
        eventBuffer = parsed.remaining
        responseId = parsed.responseId || responseId

        const pendingToolCalls = [...toolCalls.values()].filter(toolCall => toolCall.callId && toolCall.name)

        if (pendingToolCalls.length > 0 && toolRound < maxToolRounds) {
          if (!responseId) {
            throw new AgentCoreError('工具调用缺少 response id')
          }

          const executedToolCalls: ExecutedToolCall[] = []
          await Promise.allSettled(
            pendingToolCalls.map(async toolCall => {
              const approvalId = createApprovalId()
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({
                    type: 'tool_approval_required',
                    approvalId,
                    callId: toolCall.callId,
                    name: toolCall.name,
                    arguments: toolCall.arguments,
                    approvalRequired: true
                  })}\n\n`
                )
              )

              const approved = await waitForToolApproval(request.sessionId, toolCall, approvalId, signal)
              const executedToolCall = await executeToolCall(toolCall, approved)
              executedToolCalls.push(executedToolCall)
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({
                    type: 'tool_result',
                    callId: executedToolCall.call.callId,
                    name: executedToolCall.call.name,
                    output: executedToolCall.output,
                    approved
                  })}\n\n`
                )
              )
            })
          )

          const input = executedToolCalls.map(item => item.input)
          const nextResponse = await requestArkResponse(request, signal, input, responseId)
          reader = nextResponse.body!.getReader()
          decoder = new TextDecoder()
          eventBuffer = ''
          responseId = undefined
          toolCalls = new Map<string, ToolCall>()
          toolRound += 1
          return
        }

        saveSession()
        cleanup()
        controller.close()
      } catch (error) {
        cleanup()
        controller.error(error instanceof Error ? error : new Error('处理 Agent 流失败'))
      }
    },
    async cancel(reason) {
      cleanup()
      await reader.cancel(reason)
    }
  })
}

export async function streamAgentConversation(request: AgentConversationRequest) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), aiConfig.ark.timeoutMs)
  const abortRequest = () => controller.abort()

  if (request.signal?.aborted) {
    controller.abort()
  } else {
    request.signal?.addEventListener('abort', abortRequest, { once: true })
  }

  let cleanedUp = false
  const cleanup = () => {
    if (cleanedUp) {
      return
    }

    cleanedUp = true
    clearTimeout(timeout)
    request.signal?.removeEventListener('abort', abortRequest)
  }

  try {
    const response = await requestArkResponse(request, controller.signal)

    return new Response(forwardStream(response.body, cleanup, request, controller.signal), {
      status: response.status,
      headers: streamHeaders
    })
  } catch (error) {
    cleanup()

    if (error instanceof AgentCoreError) {
      throw error
    }

    if (controller.signal.aborted) {
      throw new AgentCoreError('Ark 请求超时或已被客户端取消', 504)
    }

    throw new AgentCoreError(error instanceof Error ? error.message : '调用 Ark 失败')
  }
}
