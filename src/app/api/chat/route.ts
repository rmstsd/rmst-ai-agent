import { Command, END, MemorySaver, MessagesAnnotation, START, StateGraph } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { AIMessageChunk, tool } from 'langchain'
import { z } from 'zod'

import { interrupt } from '@langchain/langgraph'

const checkpointer = new MemorySaver()

type SSEData = unknown

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
      await new Promise(resolve => setTimeout(resolve, 2000))
      return `当前${location}的天气是晴朗`
    },
    {
      name: 'get_weather',
      description: '获取天气信息',
      schema: z.object({ location: z.string().describe('城市名称') })
    }
  )
  const modelWithTools = model.bindTools([getWeather])
  const threadId = crypto.randomUUID()

  const configurable = { thread_id: threadId }

  const callModel = async (state: typeof MessagesAnnotation.State) => ({
    messages: [
      await modelWithTools.invoke(state.messages, {
        configurable
      })
    ]
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
    .compile({ checkpointer })

  const stream = await graph.stream(
    { messages: [new HumanMessage(userMessage)] },
    { configurable, streamMode: ['messages', 'tools', 'values'] }
  )
  const encoder = new TextEncoder()

  const responseStream = new ReadableStream({
    async start(controller) {
      const send = (data: SSEData) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        for await (const [mode, payload] of stream) {
          if (mode === 'values') {
            // 别删
            console.log(
              'values',
              payload.messages.map(item => item.toDict())
            )
          }
          if (mode === 'tools') {
            console.log('payload', payload)
            if (payload.event === 'on_tool_start') {
              send({ type: 'tool_start', id: payload.toolCallId, name: payload.name, input: toJsonSafe(payload.input) })
            } else if (payload.event === 'on_tool_end') {
              send({ type: 'tool_end', id: payload.toolCallId, name: payload.name, output: toJsonSafe(payload.output) })
            } else if (payload.event === 'on_tool_error') {
              send({ type: 'tool_error', id: payload.toolCallId, name: payload.name, error: toJsonSafe(payload.error) })
            } else {
              send({ type: 'tool_event', id: payload.toolCallId, name: payload.name, data: toJsonSafe(payload.data) })
            }
          }
          if (mode === 'messages') {
            const [messageChunk] = payload as [AIMessageChunk, Record<string, unknown>]
            send(messageChunk.toDict())
          }
        }

        send({ type: 'done' })
      } catch (error) {
        send({ type: 'error', error: error instanceof Error ? error.message : '请求失败' })
      } finally {
        controller.close()

        console.log(await graph.getState({ configurable }))
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
