import { aiConfig } from '@/config/ai-config'
import { AIMessage, AIMessageChunk, BaseMessage } from '@langchain/core/messages'
import { BaseChatModel, type BaseChatModelCallOptions } from '@langchain/core/language_models/chat_models'
import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager'
import { ChatGenerationChunk, type ChatResult } from '@langchain/core/outputs'
import type { ToolDefinition } from '@langchain/core/language_models/base'
import { toJsonSchema } from '@langchain/core/utils/json_schema'

type CallOptions = BaseChatModelCallOptions

interface ModelFields {
  apiKey: string
  baseUrl: string
  model: string
  timeout?: number
  store?: boolean
  tools?: ToolDefinition[]
  boundOptions?: Partial<CallOptions>
}

interface ResponsesOutputItem {
  type?: string
  id?: string
  name?: string
  call_id?: string
  arguments?: string
  content?: Array<{ type?: string; text?: string }>
  summary?: Array<{ type?: string; text?: string }>
}

interface ResponsesPayload {
  id?: string
  model?: string
  output_text?: string
  output?: ResponsesOutputItem[]
  usage?: Record<string, unknown>
  [key: string]: unknown
}

function endpointFor(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, '')
  if (normalized.endsWith('/chat/completions')) return normalized
  if (normalized.endsWith('/v1')) return `${normalized}/chat/completions`
  return `${normalized}/v1/chat/completions`
}

function contentToText(content: unknown) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map(item => {
      if (typeof item === 'string') return item
      if (!item || typeof item !== 'object') return ''
      const value = item as { text?: unknown; content?: unknown }
      return typeof value.text === 'string' ? value.text : typeof value.content === 'string' ? value.content : ''
    })
    .join('')
}

function toChatMessages(messages: BaseMessage[]) {
  return messages.flatMap<Record<string, unknown>>((message): Record<string, unknown>[] => {
    const content = contentToText(message.content)
    if (message.type === 'tool') {
      return [{ role: 'tool', tool_call_id: (message as BaseMessage & { tool_call_id?: string }).tool_call_id, content }]
    }
    if (message.type === 'ai') {
      const aiMessage = message as AIMessage
      const toolCalls = aiMessage.tool_calls ?? []
      return [
        {
          role: 'assistant',
          content: content || null,
          ...(toolCalls.length > 0
            ? {
                tool_calls: toolCalls.map(call => ({
                  id: call.id,
                  type: 'function',
                  function: {
                    name: call.name,
                    arguments: typeof call.args === 'string' ? call.args : JSON.stringify(call.args ?? {})
                  }
                }))
              }
            : {})
        }
      ]
    }
    return [{ role: message.type === 'system' ? 'system' : 'user', content }]
  }) as Array<Record<string, unknown>>
}

function chatPayloadToMessage(payload: Record<string, unknown>) {
  const choice = Array.isArray(payload.choices) ? (payload.choices[0] as Record<string, unknown>) : {}
  const rawMessage = choice.message && typeof choice.message === 'object' ? (choice.message as Record<string, unknown>) : {}
  const content = rawMessage.content
  const reasoning = rawMessage.reasoning_content ?? rawMessage.reasoning
  const blocks: Array<Record<string, unknown>> = []
  if (typeof reasoning === 'string' && reasoning) blocks.push({ type: 'reasoning', reasoning })
  if (typeof content === 'string' && content) blocks.push({ type: 'text', text: content })
  const toolCalls = Array.isArray(rawMessage.tool_calls)
    ? rawMessage.tool_calls.flatMap(call => {
        if (!call || typeof call !== 'object') return []
        const item = call as Record<string, unknown>
        const fn = item.function && typeof item.function === 'object' ? (item.function as Record<string, unknown>) : {}
        return [
          {
            id: typeof item.id === 'string' ? item.id : `call-${Math.random()}`,
            name: typeof fn.name === 'string' ? fn.name : '',
            args:
              typeof fn.arguments === 'string'
                ? (() => {
                    try {
                      return JSON.parse(fn.arguments)
                    } catch {
                      return {}
                    }
                  })()
                : {},
            type: 'tool_call' as const
          }
        ]
      })
    : []
  return new AIMessage({
    content: blocks as never,
    tool_calls: toolCalls,
    additional_kwargs: payload,
    response_metadata: { id: payload.id, model: payload.model, usage: payload.usage }
  })
}

function responseError(payload: unknown, status: number) {
  if (payload && typeof payload === 'object') {
    const value = payload as { error?: unknown; message?: unknown }
    if (value.error && typeof value.error === 'object' && typeof (value.error as { message?: unknown }).message === 'string')
      return (value.error as { message: string }).message
    if (typeof value.error === 'string') return value.error
    if (typeof value.message === 'string') return value.message
  }
  return `COdex 请求失败（${status}）`
}

function normalizeTools(tools: ToolDefinition[]) {
  return tools.map(tool => {
    const value = tool as ToolDefinition & {
      name?: string
      description?: string
      parameters?: Record<string, unknown>
      schema?: unknown
    }
    if (value.type === 'function' && value.function) {
      return {
        type: 'function',
        function: {
          name: value.function.name,
          description: value.function.description,
          parameters: value.function.parameters
        }
      }
    }
    const parameters = value.parameters ?? (value.schema ? toJsonSchema(value.schema) : { type: 'object', properties: {} })
    return {
      type: 'function' as const,
      function: {
        name: value.name ?? 'tool',
        description: value.description,
        parameters
      }
    }
  })
}

export class CodexResponsesChatModel extends BaseChatModel<CallOptions> {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly model: string
  private readonly timeout: number
  private readonly store: boolean
  private readonly boundTools: Record<string, unknown>[]
  private readonly boundOptions: Partial<CallOptions>

  constructor(fields: ModelFields) {
    super({})
    this.apiKey = fields.apiKey
    this.baseUrl = fields.baseUrl
    this.model = fields.model
    this.timeout = fields.timeout ?? 60_000
    this.store = fields.store ?? true
    this.boundTools = normalizeTools(fields.tools ?? [])
    this.boundOptions = fields.boundOptions ?? {}
  }

  bindTools(tools: ToolDefinition[], kwargs?: Partial<CallOptions>) {
    return new CodexResponsesChatModel({
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      model: this.model,
      timeout: this.timeout,
      store: this.store,
      tools,
      boundOptions: { ...this.boundOptions, ...kwargs }
    })
  }

  _llmType() {
    return 'codex-responses'
  }

  _modelType() {
    return 'chat'
  }

  _identifyingParams() {
    return { model: this.model, baseUrl: this.baseUrl }
  }

  protected async request(messages: BaseMessage[], options: CallOptions, stream: boolean, signal?: AbortSignal) {
    const requestOptions = { ...this.boundOptions, ...options }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeout)
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const endpoint = endpointFor(this.baseUrl)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: toChatMessages(messages),
          stream,
          store: this.store,
          ...(this.boundTools.length > 0 ? { tools: this.boundTools } : {}),
          ...(requestOptions.stop ? { stop: requestOptions.stop } : {})
        }),
        signal: controller.signal
      })
      if (!response.ok) throw new Error(responseError(await response.json().catch(() => null), response.status))
      return response
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  }

  async _generate(messages: BaseMessage[], options: CallOptions, _runManager?: CallbackManagerForLLMRun): Promise<ChatResult> {
    const payload = (await (await this.request(messages, options, false)).json()) as Record<string, unknown>
    const message = chatPayloadToMessage(payload)
    return { generations: [{ text: message.text, message }], llmOutput: payload }
  }

  async *_streamResponseChunks(messages: BaseMessage[], options: CallOptions, _runManager?: CallbackManagerForLLMRun) {
    const response = await this.request(messages, options, true, options.signal)
    if (!response.body) return
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let responseId: string | undefined
    const emit = (message: AIMessageChunk) => new ChatGenerationChunk({ text: message.text, message })

    while (true) {
      const { done, value } = await reader.read()
      const decoded = decoder.decode(value, { stream: !done })
      buffer += decoded
      const blocks = buffer.split(/\r?\n\r?\n/)
      buffer = blocks.pop() ?? ''
      for (const block of blocks) {
        const line = block.split(/\r?\n/).find(item => item.trimStart().startsWith('data:'))
        if (!line) continue
        const raw = line.trimStart().slice(5).trim()
        if (!raw || raw === '[DONE]') continue
        let event: Record<string, unknown>
        try {
          event = JSON.parse(raw) as Record<string, unknown>
        } catch {
          continue
        }
        responseId = typeof event.id === 'string' ? event.id : responseId
        const type = typeof event.type === 'string' ? event.type : ''
        const delta = typeof event.delta === 'string' ? event.delta : ''
        if (Array.isArray(event.choices)) {
          const choice = (
            event.choices as Array<{
              delta?: { content?: string; reasoning_content?: string; tool_calls?: Array<Record<string, unknown>> }
            }>
          )[0]
          if (choice?.delta?.content) yield emit(new AIMessageChunk(choice.delta.content))
          if (choice?.delta?.reasoning_content)
            yield emit(new AIMessageChunk({ content: [{ type: 'reasoning', reasoning: choice.delta.reasoning_content }] }))
          const toolCall = choice?.delta?.tool_calls?.[0]
          if (toolCall) {
            const fn =
              toolCall.function && typeof toolCall.function === 'object' ? (toolCall.function as Record<string, unknown>) : {}
            yield new ChatGenerationChunk({
              text: '',
              message: new AIMessageChunk({
                content: [],
                tool_call_chunks: [
                  {
                    id: typeof toolCall.id === 'string' ? toolCall.id : undefined,
                    name: typeof fn.name === 'string' ? fn.name : undefined,
                    args: typeof fn.arguments === 'string' ? fn.arguments : '',
                    index: typeof toolCall.index === 'number' ? toolCall.index : 0
                  }
                ]
              })
            })
          }
        } else if (type.includes('output_text.delta') || type === 'text.delta') {
          if (delta) yield emit(new AIMessageChunk({ content: [{ type: 'text', text: delta }] }))
        } else if (type.includes('reasoning') && type.includes('delta')) {
          if (delta) yield emit(new AIMessageChunk({ content: [{ type: 'reasoning', reasoning: delta }] }))
        } else if (type.includes('function_call_arguments.delta') && delta) {
          const item = event.item && typeof event.item === 'object' ? (event.item as Record<string, unknown>) : {}
          yield new ChatGenerationChunk({
            text: '',
            message: new AIMessageChunk({
              content: [],
              tool_call_chunks: [
                {
                  id: typeof item.call_id === 'string' ? item.call_id : undefined,
                  name: typeof item.name === 'string' ? item.name : undefined,
                  args: delta,
                  index: typeof event.output_index === 'number' ? event.output_index : 0
                }
              ]
            })
          })
        } else if (type.includes('output_item.added')) {
          const item = event.item && typeof event.item === 'object' ? (event.item as ResponsesOutputItem) : undefined
          if (item?.type === 'function_call')
            yield new ChatGenerationChunk({
              text: '',
              message: new AIMessageChunk({
                content: [],
                tool_call_chunks: [{ id: item.call_id ?? item.id, name: item.name, args: '', index: 0 }]
              })
            })
        }
      }
      if (done) break
    }
    if (responseId)
      yield new ChatGenerationChunk({
        text: '',
        message: new AIMessageChunk({ content: [], response_metadata: { id: responseId } })
      })
  }
}

export function createCodexModel() {
  return new CodexResponsesChatModel({
    apiKey: aiConfig.ark.apiKey,
    model: aiConfig.ark.modelId,
    baseUrl: aiConfig.ark.baseUrl,
    timeout: aiConfig.ark.timeoutMs,
    store: aiConfig.ark.store
  })
}
