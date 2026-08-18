import { aiConfig } from '@/config/ai-config'
import { executeTool, loadAiCapabilities } from '@/server/ai-tools'
import { createOpenAI } from '@ai-sdk/openai'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  isToolUIPart,
  jsonSchema,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  tool,
  type ModelMessage,
  type ToolSet,
  type UIMessage
} from 'ai'
import { stringProperty } from './tools/tool-types'

interface ChatSession {
  id: string
  systemPrompt: string
  messages: ModelMessage[]
  updatedAt: number
  tools: ToolSet
  uiMessages: UIMessage[]
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

function getUiMessageText(message: UIMessage) {
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('')
}

export function listSessions() {
  return [...sessions.values()]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map(session => {
      const firstUserMessage = session.uiMessages.find(message => message.role === 'user')
      return {
        id: session.id,
        title: firstUserMessage ? getUiMessageText(firstUserMessage) : '新建对话',
        messageCount: session.uiMessages.length,
        updatedAt: session.updatedAt
      }
    })
}

export function getSessionMessages(sessionId: string) {
  const session = requireSession(sessionId)
  return {
    id: session.id,
    messages: session.uiMessages
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
    tools: createTools(capabilities.tools),
    uiMessages: []
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

const completedArkInputTypes = new Set(['function_call', 'custom_tool_call'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeArkInputItems(body: BodyInit | null | undefined) {
  if (typeof body !== 'string') return body

  try {
    const request: unknown = JSON.parse(body)
    if (!isRecord(request) || !Array.isArray(request.input)) return body

    let changed = false
    const input = request.input.map(item => {
      if (!isRecord(item)) return item

      if (item.role === 'assistant') {
        const missingType = !('type' in item)
        const missingStatus = !('status' in item)
        if (!missingType && !missingStatus) return item

        changed = true
        return {
          ...item,
          ...(missingType ? { type: 'message' } : {}),
          ...(missingStatus ? { status: 'completed' } : {})
        }
      }

      if ('status' in item || typeof item.type !== 'string' || !completedArkInputTypes.has(item.type)) {
        return item
      }

      changed = true
      return { ...item, status: 'completed' }
    })

    return changed ? JSON.stringify({ ...request, input }) : body
  } catch {
    return body
  }
}

const arkFetch: typeof fetch = (input, init) =>
  fetch(input, init?.body ? { ...init, body: normalizeArkInputItems(init.body) } : init)

const ark = createOpenAI({
  apiKey: aiConfig.ark.apiKey,
  baseURL: aiConfig.ark.baseUrl,
  name: 'ark',
  fetch: arkFetch
})

// https://api-sp.claudecode.net.cn/api/codex/backend-api/codex
// sk-ant-api03--WCOnTXAm7951pVdey-SAhmNORDUEmTR8KGufKCQRLtGOh-nUKUS52U46LEpdUiFIlBMNxsHP7UmYX8WwPRPGA

function addSessionTools(session: ChatSession) {
  session.tools['get-weather-info'] = {
    description: '查询天气信息',
    inputSchema: jsonSchema<Record<string, unknown>>({ city: stringProperty('城市名称') }),
    execute: input => ({ city: input.city, temperature: '25℃' })
  }
}

function hasPendingApproval(message?: UIMessage) {
  return message?.parts.some(part => isToolUIPart(part) && part.state === 'approval-requested') ?? false
}

function mergeApprovalResponse(session: ChatSession, incomingMessage: UIMessage) {
  const storedMessage = session.uiMessages.at(-1)
  if (
    storedMessage?.role !== 'assistant' ||
    incomingMessage.role !== 'assistant' ||
    storedMessage.id !== incomingMessage.id ||
    !hasPendingApproval(storedMessage)
  ) {
    throw new Error('当前没有可审批的工具调用')
  }

  let responseCount = 0
  const mergedMessage: UIMessage = {
    ...storedMessage,
    parts: storedMessage.parts.map(part => {
      if (!isToolUIPart(part) || part.state !== 'approval-requested') return part

      const responsePart = incomingMessage.parts
        .filter(isToolUIPart)
        .find(item => item.toolCallId === part.toolCallId && item.state === 'approval-responded')
      if (responsePart?.state !== 'approval-responded' || responsePart.approval.id !== part.approval.id) return part

      responseCount += 1
      return {
        ...part,
        state: 'approval-responded' as const,
        approval: {
          ...part.approval,
          approved: responsePart.approval.approved,
          reason: responsePart.approval.reason
        }
      }
    })
  }

  if (responseCount === 0) throw new Error('工具审批结果无效')
  if (hasPendingApproval(mergedMessage)) throw new Error('请完成所有工具调用的审批')

  return [...session.uiMessages.slice(0, -1), mergedMessage]
}

async function prepareRequestMessages(session: ChatSession, messages: unknown) {
  const validation = await safeValidateUIMessages<UIMessage>({ messages })
  if ('error' in validation) throw new Error(`消息格式不正确：${validation.error.message}`)

  const incomingMessage = validation.data.at(-1)
  if (!incomingMessage) throw new Error('消息不能为空')

  if (incomingMessage.role === 'assistant') {
    return mergeApprovalResponse(session, incomingMessage)
  }

  if (incomingMessage.role !== 'user') throw new Error('消息角色不正确')
  if (incomingMessage.parts.some(part => part.type !== 'text')) throw new Error('仅支持文本消息')

  const messageText = getUiMessageText(incomingMessage).trim()
  if (!messageText || messageText.length > 20_000) throw new Error('消息内容长度不正确')
  if (hasPendingApproval(session.uiMessages.at(-1))) throw new Error('请先处理待审批的工具调用')
  if (session.uiMessages.some(message => message.id === incomingMessage.id)) throw new Error('消息已提交')

  return [...session.uiMessages, incomingMessage]
}

export async function streamUserMessage(sessionId: string, messages: unknown) {
  requireArkConfig()
  const session = requireSession(sessionId)
  addSessionTools(session)

  const requestUiMessages = await prepareRequestMessages(session, messages)
  const requestModelMessages = removeReasoningMessages(await convertToModelMessages(requestUiMessages, { tools: session.tools }))

  session.controller?.abort()

  const controller = new AbortController()
  session.controller = controller
  session.timeout = setTimeout(() => controller.abort(), aiConfig.ark.timeoutMs)
  session.uiMessages = requestUiMessages
  session.updatedAt = Date.now()

  const result = streamText({
    model: ark.responses(aiConfig.ark.modelId),
    system: session.systemPrompt,
    messages: requestModelMessages,
    tools: session.tools,
    toolApproval: () => 'user-approval',
    stopWhen: isStepCount(50),
    providerOptions: { openai: { store: false } },
    prepareStep: ({ messages, stepNumber }) => (stepNumber === 0 ? undefined : { messages: removeReasoningMessages(messages) }),
    abortSignal: controller.signal,
    onEnd: event => {
      if (session.controller !== controller) return
      session.messages = removeReasoningMessages([...requestModelMessages, ...event.responseMessages])
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
      originalMessages: requestUiMessages,
      generateMessageId: newId,
      onEnd: ({ messages: nextMessages }) => {
        session.uiMessages = nextMessages
        session.updatedAt = Date.now()
      },
      onError: error => {
        // console.log('error', JSON.stringify(error.requestBodyValues.input))
        return error instanceof Error ? error.message : String(error)
      }
    })
  })
}
