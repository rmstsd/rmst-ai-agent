import { aiConfig } from '@/config/ai-config'
import type { ApprovalDecision, ApprovalRequest, LangChainHistoryMessage, PendingApproval } from '@/types/ai'
import { Command, MemorySaver } from '@langchain/langgraph'
import { stampRetryable } from '@langchain/core/errors'
import { createDeepAgent, LocalShellBackend } from 'deepagents'
import { createArkModel, requireArkConfig } from './ark-responses-compat'
import { systemPrompts } from './system-prompts'
import { BaseMessage, coerceMessageLikeToMessage, mapStoredMessageToChatMessage } from '@langchain/core/messages'
import type { StreamEvent } from '@langchain/core/tracers/log_stream'
import { AIMessageChunk, tool, toolRetryMiddleware, toolErrorMiddleware } from 'langchain'
import z from 'zod'

export type AgentStreamEvent =
  | { type: 'MessageStart'; responseId?: string }
  | { type: 'Text'; text: string }
  | { type: 'Reasoning'; text: string }
  | { type: 'Function'; name: string; args?: string; callId: string }
  | { type: 'FunctionResult'; name: string; output?: string; status?: 'success' | 'error'; callId: string }
  | { type: 'Approval'; approval: PendingApproval }
  | { type: 'Done'; interrupted?: boolean; responseId?: string }

const sessionControllers = new Map<string, AbortController>()
const checkpointer = new MemorySaver()

let agentPromise: Promise<ReturnType<typeof createDeepAgent>> | undefined
const model = createArkModel()

async function getAgent() {
  requireArkConfig()
  if (!agentPromise) {
    agentPromise = (async () => {
      const backend = await LocalShellBackend.create({
        rootDir: process.cwd(),
        virtualMode: true,
        inheritEnv: true
      })

      const getWeather = tool(
        async ({ location }) => {
          const random = Math.random()

          // if (location === '沈阳') {
          //   throw stampRetryable(new Error('不支持 沈阳'), false)
          // }

          if (random > 0.4) {
            throw stampRetryable(new Error('模拟错误'), true)
          }
          return `${location}温度是30摄氏度`
        },
        {
          name: 'get_weather',
          description: 'Get the weather',
          schema: z.object({
            location: z.string().describe('The location to get the weather for')
          })
        }
      )

      return createDeepAgent({
        model,
        backend,
        tools: [getWeather],
        skills: ['/src/skills/'],
        systemPrompt: systemPrompts.join('\n'),
        middleware: [
          toolErrorMiddleware({
            onError: (error, request) => `调用工具 '${request.toolCall.name}' 失败: ${errorMessage(error)}。请检查后重试。`
          }),
          toolRetryMiddleware({
            maxRetries: 2,
            backoffFactor: 2.0,
            initialDelayMs: 1000,
            onFailure: 'error'
          })
        ],
        checkpointer,
        interruptOn: {
          write_file: true,
          edit_file: true,
          delete: true,
          execute: true,
          task: true
          // get_weather: true
        }
      })
    })()
  }
  return agentPromise
}

export function stopSession(sessionId: string) {
  sessionControllers.get(sessionId)?.abort()
  sessionControllers.delete(sessionId)
}

interface ContentParts {
  text: string
  reasoning: string
}

function contentToParts(content: unknown): ContentParts {
  const parts: ContentParts = { text: '', reasoning: '' }
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
    const reasoning =
      typeof value.reasoning === 'string'
        ? value.reasoning
        : typeof value.reasoning_content === 'string'
          ? value.reasoning_content
          : isReasoning && Array.isArray(value.summary)
            ? contentToParts(value.summary).text
            : ''
    const text = typeof value.text === 'string' ? value.text : typeof value.content === 'string' ? value.content : ''

    if (reasoning) parts.reasoning += reasoning
    if (text) {
      if (isReasoning) parts.reasoning += text
      else parts.text += text
    }
  }

  return parts
}

function stringifyArgs(value: unknown) {
  if (value === undefined) return undefined
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function errorMessage(value: unknown) {
  const message =
    value instanceof Error ? value.message : isRecord(value) && typeof value.message === 'string' ? value.message : String(value)
  const stackIndex = message.search(/\r?\n\s*at\s+/)
  return message
    .slice(0, stackIndex === -1 ? message.length : stackIndex)
    .replace(/^(?:Error|TypeError|RangeError|ReferenceError|SyntaxError):\s*/, '')
    .trim()
}

function toolOutputToText(value: unknown, cleanError = false) {
  if (typeof value === 'string') return cleanError ? errorMessage(value) : value
  if (value instanceof Error) return errorMessage(value)
  if (BaseMessage.isInstance(value)) {
    const parts = contentToParts(value.content)
    const status = (value as BaseMessage & { status?: string }).status
    const output = parts.text || parts.reasoning || '无'
    return cleanError || status === 'error' ? errorMessage(output) : output
  }
  if (isRecord(value)) {
    if (value.error !== undefined) return errorMessage(value.error)
    if (isRecord(value.kwargs)) return toolOutputToText(value.kwargs, cleanError || value.status === 'error')
    if ('content' in value) {
      const parts = contentToParts(value.content)
      if (parts.text || parts.reasoning) {
        const output = parts.text || parts.reasoning
        return cleanError || value.status === 'error' ? errorMessage(output) : output
      }
    }
  }
  const parts = contentToParts(value)
  return parts.text || parts.reasoning || stringifyArgs(value) || '无'
}

function toolOutputStatus(value: unknown): 'success' | 'error' {
  if (!isRecord(value)) return 'success'
  if (value.status === 'error') return 'error'
  return isRecord(value.kwargs) ? toolOutputStatus(value.kwargs) : 'success'
}

function toStoredMessage(value: unknown): LangChainHistoryMessage | undefined {
  try {
    const message =
      isRecord(value) && isRecord(value.data) && typeof value.type === 'string'
        ? mapStoredMessageToChatMessage(value as never)
        : coerceMessageLikeToMessage(value as never)
    return message.toDict() as unknown as LangChainHistoryMessage
  } catch {
    return undefined
  }
}

function toStoredMessages(value: unknown): LangChainHistoryMessage[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    const message = toStoredMessage(item)
    return message ? [message] : []
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function extractApprovalFromSnapshot(snapshot: unknown): PendingApproval | undefined {
  if (!isRecord(snapshot)) return undefined
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : []
  const interrupts = tasks.flatMap(task => {
    if (!isRecord(task) || !Array.isArray(task.interrupts)) return []
    return task.interrupts
  })

  for (const interrupt of interrupts) {
    if (!isRecord(interrupt)) continue
    const value = interrupt.value
    if (!isRecord(value)) continue
    const rawRequests = Array.isArray(value.actionRequests)
      ? value.actionRequests
      : Array.isArray(value.action_requests)
        ? value.action_requests
        : []
    if (rawRequests.length === 0) continue

    const rawConfigs = Array.isArray(value.reviewConfigs)
      ? value.reviewConfigs
      : Array.isArray(value.review_configs)
        ? value.review_configs
        : []
    const configs = new Map<string, string[]>()
    for (const rawConfig of rawConfigs) {
      if (!isRecord(rawConfig) || typeof rawConfig.actionName !== 'string') continue
      const decisions = Array.isArray(rawConfig.allowedDecisions)
        ? rawConfig.allowedDecisions.filter((decision): decision is string => typeof decision === 'string')
        : ['approve', 'edit', 'reject', 'respond']
      configs.set(rawConfig.actionName, decisions)
    }

    const requests: ApprovalRequest[] = rawRequests.flatMap((rawRequest, index) => {
      if (!isRecord(rawRequest) || typeof rawRequest.name !== 'string') return []
      const allowedDecisions = configs.get(rawRequest.name) ?? ['approve', 'edit', 'reject', 'respond']
      return [
        {
          id: typeof rawRequest.id === 'string' ? rawRequest.id : `${rawRequest.name}-${index}`,
          name: rawRequest.name,
          args: rawRequest.args,
          description: typeof rawRequest.description === 'string' ? rawRequest.description : undefined,
          allowedDecisions: allowedDecisions as ApprovalDecision['type'][]
        }
      ]
    })

    if (requests.length > 0) return { requests }
  }
  return undefined
}

async function getSnapshot(sessionId: string) {
  const agent = await getAgent()
  return agent.getState({ configurable: { thread_id: sessionId } }) as unknown
}

async function getPendingApproval(sessionId: string) {
  const snapshot = await getSnapshot(sessionId)
  return extractApprovalFromSnapshot(snapshot)
}

export async function getConversationHistory(sessionId: string) {
  const snapshot = await getSnapshot(sessionId)
  const values = isRecord(snapshot) && isRecord(snapshot.values) ? snapshot.values : {}

  return {
    messages: toStoredMessages(values.messages),
    pendingApproval: extractApprovalFromSnapshot(snapshot)
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

async function streamRun(sessionId: string, input: unknown, signal: AbortSignal, onEvent: (event: AgentStreamEvent) => void) {
  const agent = await getAgent()
  const config = {
    version: 'v2' as const,
    signal,
    configurable: { thread_id: sessionId }
  }
  const stream = await agent.streamEvents(input as never, config as never)
  const emittedToolCalls = new Set<string>()
  let chatModelRunId = ''

  for await (const event of stream as AsyncIterable<StreamEvent>) {
    if (event.event === 'on_chat_model_stream') {
      const chunk = event.data?.chunk
      if (!AIMessageChunk.isInstance(chunk)) continue
      if (event.run_id !== chatModelRunId) {
        chatModelRunId = event.run_id
        onEvent({ type: 'MessageStart', responseId: event.run_id })
      }
      const parts = contentToParts(chunk?.content)
      const additionalKwargs = chunk.additional_kwargs
      const reasoning =
        parts.reasoning ||
        (typeof additionalKwargs?.reasoning_content === 'string' ? additionalKwargs.reasoning_content : '') ||
        (typeof additionalKwargs?.reasoning === 'string' ? additionalKwargs.reasoning : '')
      if (reasoning) onEvent({ type: 'Reasoning', text: reasoning })
      if (parts.text) onEvent({ type: 'Text', text: parts.text })
    }

    if (event.event === 'on_tool_start') {
      const inputValue = event.data?.input
      const callId =
        event.run_id ??
        (isRecord(inputValue) && typeof inputValue.tool_call_id === 'string'
          ? inputValue.tool_call_id
          : `${event.name ?? 'tool'}-${Date.now()}`)
      if (!emittedToolCalls.has(callId)) {
        emittedToolCalls.add(callId)
        onEvent({ type: 'Function', name: event.name ?? 'tool', args: stringifyArgs(inputValue), callId })
      }
    }

    if (event.event === 'on_tool_end') {
      const callId = event.run_id ?? `${event.name ?? 'tool'}-${Date.now()}`
      const output = event.data?.output
      onEvent({
        type: 'FunctionResult',
        name: event.name ?? 'tool',
        output: toolOutputToText(output),
        status: toolOutputStatus(output),
        callId
      })
    }

    if (event.event === 'on_tool_error') {
      const callId = event.run_id ?? `${event.name ?? 'tool'}-${Date.now()}`
      onEvent({
        type: 'FunctionResult',
        name: event.name ?? 'tool',
        output: toolOutputToText(event.data?.error, true),
        status: 'error',
        callId
      })
    }
  }

  const snapshot = await getSnapshot(sessionId)
  const pendingApproval = extractApprovalFromSnapshot(snapshot)
  if (pendingApproval) onEvent({ type: 'Approval', approval: pendingApproval })
  onEvent({ type: 'Done', interrupted: Boolean(pendingApproval) })
}

async function runWithController(
  sessionId: string,
  input: unknown,
  signal: AbortSignal,
  onEvent: (event: AgentStreamEvent) => void
) {
  requireArkConfig()
  sessionControllers.get(sessionId)?.abort()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), aiConfig.ark.timeoutMs)
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  sessionControllers.set(sessionId, controller)

  try {
    await streamRun(sessionId, input, controller.signal, onEvent)
  } catch (error) {
    if (isAbortError(error)) {
      console.warn('[AI Agent] 生成已取消', { sessionId })
    } else {
      console.error('[AI Agent] 流式调用失败', { sessionId, error })
    }
    throw error
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
    if (sessionControllers.get(sessionId) === controller) sessionControllers.delete(sessionId)
  }
}

export async function streamAgentMessage(
  sessionId: string,
  message: string,
  signal: AbortSignal,
  onEvent: (event: AgentStreamEvent) => void
) {
  await runWithController(
    sessionId,
    { messages: [{ role: 'user', content: message, additional_kwargs: { createdAt: Date.now() } }] },
    signal,
    onEvent
  )
}

export async function streamAgentApproval(
  sessionId: string,
  decisions: ApprovalDecision[],
  signal: AbortSignal,
  onEvent: (event: AgentStreamEvent) => void
) {
  const pendingApproval = await getPendingApproval(sessionId)
  if (!pendingApproval) throw new Error('当前会话没有等待审批的工具调用')
  if (decisions.length !== pendingApproval.requests.length) throw new Error('审批决定数量与待审批工具调用不一致')

  await runWithController(sessionId, new Command({ resume: { decisions } }), signal, onEvent)
}
