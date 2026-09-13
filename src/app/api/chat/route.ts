import { END, MessagesAnnotation, START, StateGraph } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { tool } from 'langchain'
import { z } from 'zod'

type SSEData = { type: string; [key: string]: unknown }

function toJsonSafe(value: unknown): unknown {
  const candidate = value as { kwargs?: { content?: unknown } } | null
  if (candidate && typeof candidate === 'object' && candidate.kwargs && 'content' in candidate.kwargs) {
    return candidate.kwargs.content
  }
  try {
    JSON.stringify(value)
    return value
  } catch {
    return String(value)
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { message?: string }
  const userMessage = body.message?.trim() || '沈阳和上海天气如何'
  const model = new ChatOpenAI({
    apiKey: 'sk-c948ff9124414de5b604aeb0e41e26df',
    configuration: { baseURL: 'https://api.deepseek.com' },
    modelName: 'deepseek-v4-flash',
    reasoning: { effort: 'none' },
    streaming: true
  })
  const getWeather = tool(
    async ({ location }) => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      return `当前${location}的天气是晴朗`
    },
    {
      name: 'get_weather',
      description: '获取天气信息',
      schema: z.object({ location: z.string().describe('城市名称') })
    }
  )
  const modelWithTools = model.bindTools([getWeather])
  const callModel = async (state: typeof MessagesAnnotation.State) => ({
    messages: [await modelWithTools.invoke(state.messages)]
  })
  const shouldContinue = (state: typeof MessagesAnnotation.State) => {
    const lastMessage = state.messages.at(-1)
    return AIMessage.isInstance(lastMessage) && lastMessage.tool_calls?.length ? 'tool' : END
  }
  const graph = new StateGraph(MessagesAnnotation)
    .addNode('callModel', callModel)
    .addNode('tool', new ToolNode([getWeather]))
    .addEdge(START, 'callModel')
    .addConditionalEdges('callModel', shouldContinue, ['tool', END])
    .addEdge('tool', 'callModel')
    .compile()

  const stream = await graph.stream({ messages: [new HumanMessage(userMessage)] }, { streamMode: ['messages', 'tools'] })
  const encoder = new TextEncoder()

  const responseStream = new ReadableStream({
    async start(controller) {
      const send = (data: SSEData) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      const toolCallIds = new Map<number, string>()
      try {
        for await (const [mode, payload] of stream) {
          if (mode === 'tools') {
            const event = payload

            if (event.event === 'on_tool_start') {
              send({ type: 'tool_start', id: event.toolCallId, name: event.name, input: toJsonSafe(event.input) })
            } else if (event.event === 'on_tool_end') {
              send({ type: 'tool_end', id: event.toolCallId, name: event.name, output: toJsonSafe(event.output) })
            } else if (event.event === 'on_tool_error') {
              send({ type: 'tool_error', id: event.toolCallId, name: event.name, error: toJsonSafe(event.error) })
            } else {
              send({ type: 'tool_event', id: event.toolCallId, name: event.name, data: toJsonSafe(event.data) })
            }
          }
          if (mode === 'messages') {
            const [messageChunk] = payload as [Record<string, any>, Record<string, unknown>]

            if (typeof messageChunk.text === 'string' && messageChunk.text) {
              send({ type: 'assistant_delta', id: messageChunk.id, text: messageChunk.text })
            }
            for (const toolChunk of messageChunk.tool_call_chunks ?? []) {
              const index = typeof toolChunk.index === 'number' ? toolChunk.index : 0
              if (toolChunk.id) {
                toolCallIds.set(index, toolChunk.id)
              }
              const id = toolChunk.id ?? toolCallIds.get(index)
              if (id && (toolChunk.id || toolChunk.name)) {
                send({ type: 'tool_call_start', id, name: toolChunk.name })
              }
              if (toolChunk.args && id) {
                send({ type: 'tool_call_args', id, args: toolChunk.args })
              }
            }
          }
        }
        send({ type: 'done' })
      } catch (error) {
        send({ type: 'error', error: error instanceof Error ? error.message : '请求失败' })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(responseStream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'X-Accel-Buffering': 'no'
    }
  })
}
