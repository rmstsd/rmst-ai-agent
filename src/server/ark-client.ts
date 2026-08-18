import { aiConfig } from '@/config/ai-config'
import { executeTool, loadAiCapabilities } from '@/server/ai-tools'
import { createOpenAI } from '@ai-sdk/openai'
import {
  createUIMessageStreamResponse,
  isStepCount,
  jsonSchema,
  streamText,
  toUIMessageStream,
  tool,
  type ModelMessage,
  type ToolSet
} from 'ai'
import { stringProperty } from './tools/tool-types'

interface ChatSession {
  id: string
  systemPrompt: string
  messages: ModelMessage[]
  updatedAt: number
  tools: ToolSet
  controller?: AbortController
  timeout?: ReturnType<typeof setTimeout>
}

const sessions = new Map<string, ChatSession>()

function requireArkConfig() {
  if (!aiConfig.ark.apiKey || !aiConfig.ark.modelId) {
    throw new Error('请先在 src/config/ai-config.ts 中填写 Ark apiKey 和 modelId')
  }
}

function newId() {
  return crypto.randomUUID().replaceAll('-', '')
}

type ToolDefinitions = Awaited<ReturnType<typeof loadAiCapabilities>>['tools']

function createTools(definitions: ToolDefinitions): ToolSet {
  return Object.fromEntries(
    definitions.map(definition => [
      definition.name,
      tool({
        description: definition.description,
        inputSchema: jsonSchema<Record<string, unknown>>(definition.parameters as never),
        execute: input => executeTool(definition.name, JSON.stringify(input))
      })
    ])
  )
}

function removeReasoningMessages(messages: ModelMessage[]) {
  return messages.flatMap<ModelMessage>(message => {
    if (message.role !== 'assistant' || typeof message.content === 'string') {
      return [message]
    }

    const content = message.content.filter(part => part.type !== 'reasoning')
    return content.length > 0 ? [{ ...message, content } as ModelMessage] : []
  })
}

function getMessageText(message: ModelMessage) {
  if (typeof message.content === 'string') return message.content
  return message.content
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('')
}

export function listSessions() {
  return [...sessions.values()]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map(session => {
      const firstUserMessage = session.messages.find(message => message.role === 'user')
      return {
        id: session.id,
        title: firstUserMessage ? getMessageText(firstUserMessage) : '新建对话',
        messageCount: session.messages.filter(message => message.role === 'user' || message.role === 'assistant').length,
        updatedAt: session.updatedAt
      }
    })
}

export function getSessionMessages(sessionId: string) {
  const session = requireSession(sessionId)
  return {
    id: session.id,
    messages: session.messages.flatMap((message, index) => {
      if (message.role !== 'user' && message.role !== 'assistant') return []
      const text = getMessageText(message)
      return text ? [{ id: `${session.id}-${index}`, role: message.role, text }] : []
    })
  }
}

export async function createSession() {
  requireArkConfig()
  const capabilities = await loadAiCapabilities()

  const session: ChatSession = {
    id: newId(),
    systemPrompt: capabilities.systemPrompts.join('|||'),
    messages: [],
    updatedAt: Date.now(),
    tools: createTools(capabilities.tools)
  }

  sessions.set(session.id, session)
  return session.id
}

function requireSession(sessionId: string) {
  const session = sessions.get(sessionId)
  if (!session) throw new Error(`会话 ${sessionId} 不存在或已过期`)
  return session
}

function clearRequest(session: ChatSession, controller: AbortController) {
  if (session.timeout) clearTimeout(session.timeout)
  if (session.controller === controller) {
    session.controller = undefined
    session.timeout = undefined
  }
}

export function stopSession(sessionId: string) {
  const session = requireSession(sessionId)
  if (session.timeout) clearTimeout(session.timeout)
  session.controller?.abort()
  session.controller = undefined
  session.timeout = undefined
}

const ark = createOpenAI({
  apiKey: aiConfig.ark.apiKey,
  baseURL: aiConfig.ark.baseUrl,
  name: 'ark'
})

export function streamUserMessage(sessionId: string, message: string) {
  requireArkConfig()
  const session = requireSession(sessionId)
  session.controller?.abort()

  const controller = new AbortController()
  session.controller = controller
  session.timeout = setTimeout(() => controller.abort(), aiConfig.ark.timeoutMs)

  const userMessage: ModelMessage = { role: 'user', content: message }

  session.tools['get-weather-info'] = {
    description: '查询天气信息',
    inputSchema: jsonSchema<Record<string, unknown>>({ city: stringProperty('城市名称') }),
    execute: input => ({ city: input.city, temperature: '25℃' })
  }

  const result = streamText({
    model: ark.responses(aiConfig.ark.modelId),
    system: session.systemPrompt,
    messages: [...session.messages, userMessage],
    tools: session.tools,
    stopWhen: isStepCount(50),
    providerOptions: { openai: { store: false } },
    prepareStep: ({ messages, stepNumber }) => (stepNumber === 0 ? undefined : { messages: removeReasoningMessages(messages) }),
    abortSignal: controller.signal,
    onEnd: event => {
      if (session.controller !== controller) return
      session.messages = removeReasoningMessages([...session.messages, userMessage, ...event.responseMessages])
      session.updatedAt = Date.now()

      clearRequest(session, controller)
    },
    onAbort: () => clearRequest(session, controller),
    onError: () => clearRequest(session, controller)
  })
  console.log('streamUserMessage end')

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools: session.tools,
      onError: error => {
        // console.log('error', JSON.stringify(error.requestBodyValues.input))
        return error instanceof Error ? error.message : String(error)
      }
    })
  })
}
