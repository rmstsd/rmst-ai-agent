import { aiConfig } from '@/config/ai-config'
import { ChatOpenAI } from '@langchain/openai'
import { createAgent, createMiddleware } from 'langchain'
import { systemPrompts } from './system-prompts'

interface AgentSession {
  id: string
  createdAt: number
  lastResponseId?: string
  controller?: AbortController
}

export type AgentStreamEvent = { type: 'Text'; text: string } | { type: 'Done'; responseId?: string }

const sessions = new Map<string, AgentSession>()

function requireArkConfig() {
  if (!aiConfig.ark.apiKey || !aiConfig.ark.modelId || !aiConfig.ark.baseUrl) {
    throw new Error('请先在 src/config/ai-config.ts 中填写 Ark 配置')
  }
}

const model = new ChatOpenAI({
  apiKey: aiConfig.ark.apiKey,
  model: aiConfig.ark.modelId,
  streaming: true,
  useResponsesApi: true,
  timeout: aiConfig.ark.timeoutMs,
  configuration: {
    baseURL: aiConfig.ark.baseUrl
  },
  modelKwargs: {
    store: aiConfig.ark.store
  }
})

function normalizeArkResponsePayload(value: unknown) {
  if (!value || typeof value !== 'object') return value
  const payload = value as { output?: unknown }
  if (!Array.isArray(payload.output)) return value

  return {
    ...payload,
    output: payload.output.map(item => {
      if (!item || typeof item !== 'object') return item
      const outputItem = item as { type?: unknown; content?: unknown }
      if (outputItem.type !== 'message' || !Array.isArray(outputItem.content)) return item

      return {
        ...outputItem,
        content: outputItem.content.map(part => {
          if (!part || typeof part !== 'object') return part
          const contentPart = part as { type?: unknown; annotations?: unknown }
          if (contentPart.type !== 'output_text' || Array.isArray(contentPart.annotations)) return part
          return { ...contentPart, annotations: [] }
        })
      }
    })
  }
}

function normalizeArkResponseEvent(value: unknown) {
  if (!value || typeof value !== 'object') return value
  const event = value as { response?: unknown }
  if (!event.response || typeof event.response !== 'object') return normalizeArkResponsePayload(value)
  return { ...event, response: normalizeArkResponsePayload(event.response) }
}

function patchArkResponsesModel(chatModel: ChatOpenAI) {
  const responsesModel = (
    chatModel as unknown as {
      responses: {
        completionWithRetry: (...args: unknown[]) => Promise<unknown>
        __arkResponseCompatibilityPatched?: boolean
      }
    }
  ).responses
  if (responsesModel.__arkResponseCompatibilityPatched) return
  responsesModel.__arkResponseCompatibilityPatched = true

  const originalCompletionWithRetry = responsesModel.completionWithRetry.bind(responsesModel)

  responsesModel.completionWithRetry = async (...args: unknown[]) => {
    const result = await originalCompletionWithRetry(...args)
    const request = args[0]
    if (request && typeof request === 'object' && (request as { stream?: unknown }).stream === true) {
      return (async function* () {
        for await (const event of result as AsyncIterable<unknown>) {
          yield normalizeArkResponseEvent(event)
        }
      })()
    }
    return normalizeArkResponseEvent(result)
  }
}

patchArkResponsesModel(model)

const chatOpenAIPrototype = ChatOpenAI.prototype as unknown as {
  withConfig: (this: ChatOpenAI, config: Record<string, unknown>) => ChatOpenAI
  __arkWithConfigCompatibilityPatched?: boolean
}

if (!chatOpenAIPrototype.__arkWithConfigCompatibilityPatched) {
  const originalWithConfig = chatOpenAIPrototype.withConfig
  chatOpenAIPrototype.withConfig = function (this: ChatOpenAI, config: Record<string, unknown>) {
    const configuredModel = originalWithConfig.call(this, config)
    patchArkResponsesModel(configuredModel)
    return configuredModel
  }
  chatOpenAIPrototype.__arkWithConfigCompatibilityPatched = true
}

const responseContextMiddleware = createMiddleware({
  name: 'ArkResponseContext',
  wrapModelCall: async (request, handler) => {
    const previousResponseId = request.runtime.configurable?.previous_response_id
    if (typeof previousResponseId !== 'string' || !previousResponseId) return handler(request)

    const configurableModel = request.model as unknown as {
      withConfig: (config: Record<string, unknown>) => unknown
    }
    const modelWithPreviousResponse = configurableModel.withConfig({ previous_response_id: previousResponseId })
    return handler({ ...request, model: modelWithPreviousResponse as never })
  }
})

const agent = createAgent({
  model,
  systemPrompt: systemPrompts.join('\n'),
  middleware: [responseContextMiddleware]
})

function newId() {
  return crypto.randomUUID().replaceAll('-', '')
}

export function createSession() {
  requireArkConfig()
  const session: AgentSession = {
    id: newId(),
    createdAt: Date.now()
  }
  sessions.set(session.id, session)
  return session.id
}

function requireSession(sessionId: string) {
  const session = sessions.get(sessionId)
  if (!session) throw new Error('会话不存在或已过期，请新建对话')
  return session
}

export function stopSession(sessionId: string) {
  const session = requireSession(sessionId)
  session.controller?.abort()
  session.controller = undefined
}

function contentToText(content: unknown) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map(part => {
      if (typeof part === 'string') return part
      if (!part || typeof part !== 'object') return ''
      const value = part as { text?: unknown; content?: unknown }
      return typeof value.text === 'string' ? value.text : typeof value.content === 'string' ? value.content : ''
    })
    .join('')
}

function responseIdFrom(value: unknown) {
  if (!value || typeof value !== 'object') return undefined
  const item = value as {
    response_metadata?: { id?: unknown }
    additional_kwargs?: { response_metadata?: { id?: unknown } }
  }
  const id = item.response_metadata?.id ?? item.additional_kwargs?.response_metadata?.id
  return typeof id === 'string' && id ? id : undefined
}

export async function streamAgentMessage(
  sessionId: string,
  message: string,
  signal: AbortSignal,
  onEvent: (event: AgentStreamEvent) => void
) {
  requireArkConfig()
  const session = requireSession(sessionId)
  session.controller?.abort()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), aiConfig.ark.timeoutMs)
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  session.controller = controller

  try {
    const stream = await agent.streamEvents(
      {
        messages: [{ role: 'user', content: message }]
      } as never,
      {
        version: 'v2',
        signal: controller.signal,
        configurable: session.lastResponseId ? { previous_response_id: session.lastResponseId } : {}
      }
    )

    for await (const event of stream as AsyncIterable<{ event?: string; data?: { chunk?: unknown; output?: unknown } }>) {
      if (event.event === 'on_chat_model_stream') {
        const chunk = event.data?.chunk as { content?: unknown } | undefined
        const text = contentToText(chunk?.content)
        const responseId = responseIdFrom(chunk)
        if (responseId) session.lastResponseId = responseId
        if (text) onEvent({ type: 'Text', text })
      } else if (event.event === 'on_chat_model_end') {
        const responseId = responseIdFrom(event.data?.output)
        if (responseId) session.lastResponseId = responseId
      }
    }

    onEvent({ type: 'Done', responseId: session.lastResponseId })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[AI Agent] 生成已取消', { sessionId })
    } else {
      console.error('[AI Agent] 流式调用失败', { sessionId, error })
    }
    throw error
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
    if (session.controller === controller) session.controller = undefined
  }
}
