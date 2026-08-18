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

interface ChatSession {
  id: string
  systemPrompt: string
  lastResponseId?: string
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

export async function createSession() {
  requireArkConfig()
  const capabilities = await loadAiCapabilities()

  const session: ChatSession = {
    id: newId(),
    systemPrompt: capabilities.systemPrompts.join('|||'),
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

  console.log('streamUserMessage start', userMessage)
  const result = streamText({
    model: ark.responses(aiConfig.ark.modelId),
    system: session.systemPrompt,
    messages: [userMessage],
    tools: session.tools,
    stopWhen: isStepCount(5),
    providerOptions: session.lastResponseId ? { openai: { previousResponseId: session.lastResponseId } } : undefined,
    abortSignal: controller.signal,
    onEnd: event => {
      if (session.controller !== controller) return
      session.lastResponseId = event.response.id
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
        console.log('error', JSON.stringify(error.requestBodyValues.input))
        return error instanceof Error ? error.message : String(error)
      }
    })
  })
}
