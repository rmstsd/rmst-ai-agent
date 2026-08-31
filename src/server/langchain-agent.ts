import { aiConfig } from '@/config/ai-config'
import type { ApprovalDecision, ApprovalRequest, ChatMessage, PendingApproval } from '@/types/ai'
import { Command } from '@langchain/langgraph'
import { createDeepAgent, LocalShellBackend } from 'deepagents'
import { createArkModel, requireArkConfig } from './ark-responses-compat'
import {
  checkpointer,
  deleteSessionData,
  getSession as getStoredSession,
  insertSession,
  listSessions as listStoredSessions,
  touchSession as touchStoredSession,
  updateSessionTitle
} from './session-repository'
import { systemPrompts } from './system-prompts'
import { writeFile } from 'node:fs/promises'
import { tool } from 'langchain'
import z from 'zod'

interface AgentSession {
  id: string
  createdAt: number
}

export type AgentStreamEvent =
  | { type: 'Text'; text: string }
  | { type: 'Function'; name: string; args?: string; callId: string }
  | { type: 'Approval'; approval: PendingApproval }
  | { type: 'Done'; interrupted?: boolean; responseId?: string }

const sessionControllers = new Map<string, AbortController>()

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
        checkpointer,
        interruptOn: {
          write_file: true,
          edit_file: true,
          delete: true,
          execute: true,
          task: true,
          get_weather: true
        }
      })
    })()
  }
  return agentPromise
}

function newId() {
  return crypto.randomUUID().replaceAll('-', '')
}

export function listSessions() {
  return listStoredSessions()
}

export function getSession(sessionId: string) {
  return getStoredSession(sessionId)
}

export function createSession(title = '新建对话') {
  requireArkConfig()
  const id = newId()
  const now = Date.now()
  const normalizedTitle = title.trim().slice(0, 120) || '新建对话'
  insertSession(id, normalizedTitle, now)
  return id
}

function requireSession(sessionId: string) {
  const stored = getSession(sessionId)
  if (!stored) throw new Error('会话不存在或已过期，请新建对话')
  return { id: stored.id, createdAt: stored.createdAt }
}

export function stopSession(sessionId: string) {
  requireSession(sessionId)
  sessionControllers.get(sessionId)?.abort()
  sessionControllers.delete(sessionId)
}

export function updateSession(sessionId: string, input: { title?: string }) {
  const session = requireSession(sessionId)
  if (input.title !== undefined) {
    const title = input.title.trim().slice(0, 120)
    if (!title) throw new Error('会话标题不能为空')
    updateSessionTitle(sessionId, title, Date.now())
  }
  return getSession(sessionId)
}

export async function deleteSession(sessionId: string) {
  requireSession(sessionId)
  sessionControllers.get(sessionId)?.abort()
  sessionControllers.delete(sessionId)
  await deleteSessionData(sessionId)
}

function touchSession(sessionId: string, title?: string) {
  touchStoredSession(sessionId, title?.trim().slice(0, 120), Date.now())
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

function stringifyArgs(value: unknown) {
  if (value === undefined) return undefined
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function extractMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const message = item as {
      id?: unknown
      type?: unknown
      content?: unknown
      additional_kwargs?: { createdAt?: unknown }
    }
    const role = message.type === 'human' ? 'user' : message.type === 'ai' ? 'assistant' : undefined
    if (!role) return []
    const content = contentToText(message.content)
    if (!content) return []
    const createdAt = message.additional_kwargs?.createdAt
    return [
      {
        id: typeof message.id === 'string' && message.id ? message.id : `restored-${index}`,
        role,
        content,
        createdAt: typeof createdAt === 'number' ? createdAt : 0,
        status: 'done'
      }
    ]
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

export async function getSessionSnapshot(sessionId: string) {
  const session = requireSession(sessionId)
  const snapshot = await getSnapshot(sessionId)
  const values = isRecord(snapshot) && isRecord(snapshot.values) ? snapshot.values : {}
  const pendingApproval = extractApprovalFromSnapshot(snapshot)
  const metadata = getSession(sessionId)

  return {
    sessionId: session.id,
    createdAt: session.createdAt,
    title: metadata?.title,
    updatedAt: metadata?.updatedAt,
    messages: extractMessages(values.messages),
    pendingApproval
  }
}

interface RawStreamEvent {
  event?: string
  name?: string
  data?: {
    chunk?: unknown
    input?: unknown
    output?: unknown
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

async function streamRun(session: AgentSession, input: unknown, signal: AbortSignal, onEvent: (event: AgentStreamEvent) => void) {
  const agent = await getAgent()
  const config = {
    version: 'v2' as const,
    signal,
    configurable: { thread_id: session.id }
  }
  const stream = await agent.streamEvents(input as never, config as never)
  const emittedToolCalls = new Set<string>()

  for await (const event of stream as AsyncIterable<RawStreamEvent>) {
    if (event.event === 'on_chat_model_stream') {
      const chunk = event.data?.chunk as { content?: unknown } | undefined
      const text = contentToText(chunk?.content)
      if (text) onEvent({ type: 'Text', text })
    }

    if (event.event === 'on_tool_start') {
      const inputValue = event.data?.input
      const callId =
        isRecord(inputValue) && typeof inputValue.tool_call_id === 'string'
          ? inputValue.tool_call_id
          : `${event.name ?? 'tool'}-${Date.now()}`
      if (!emittedToolCalls.has(callId)) {
        emittedToolCalls.add(callId)
        onEvent({ type: 'Function', name: event.name ?? 'tool', args: stringifyArgs(inputValue), callId })
      }
    }
  }

  const snapshot = await getSnapshot(session.id)
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
  const session = requireSession(sessionId)
  touchSession(sessionId)
  sessionControllers.get(sessionId)?.abort()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), aiConfig.ark.timeoutMs)
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  sessionControllers.set(sessionId, controller)

  try {
    await streamRun(session, input, controller.signal, onEvent)
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
  requireSession(sessionId)
  touchSession(sessionId, message)
  await runWithController(sessionId, { messages: [{ role: 'user', content: message }] }, signal, onEvent)
}

export async function streamAgentApproval(
  sessionId: string,
  decisions: ApprovalDecision[],
  signal: AbortSignal,
  onEvent: (event: AgentStreamEvent) => void
) {
  requireSession(sessionId)
  const pendingApproval = (await getSessionSnapshot(sessionId)).pendingApproval
  if (!pendingApproval) throw new Error('当前会话没有等待审批的工具调用')
  if (decisions.length !== pendingApproval.requests.length) throw new Error('审批决定数量与待审批工具调用不一致')

  await runWithController(sessionId, new Command({ resume: { decisions } }), signal, onEvent)
}
