import { AIMessageChunk } from '@langchain/core/messages'
import type { ToolCall } from '@langchain/core/messages'
import type { Interrupt, StreamOutputMap } from '@langchain/langgraph'

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
type JsonObject = { [key: string]: JsonValue }

type SSEData = JsonValue | object

type StreamItem = StreamOutputMap<
  ['messages', 'tools', 'values'],
  false,
  Record<string, never>,
  Record<string, unknown>,
  string,
  Record<string, never>,
  Record<string, never>,
  undefined
>

type StreamOptions = {
  initialEvents?: SSEData[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toJsonSafe(value: unknown): JsonValue {
  const candidate = value as { kwargs?: { content?: unknown } } | null
  if (candidate && typeof candidate === 'object' && candidate.kwargs && 'content' in candidate.kwargs) {
    return toJsonSafe(candidate.kwargs.content)
  }
  try {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) return null
    return JSON.parse(serialized) as JsonValue
  } catch {
    return String(value)
  }
}

type ParsedToolCall = {
  id: string
  name: string
  args: JsonValue
}

function isToolCall(value: unknown): value is ToolCall<string, Record<string, unknown>> {
  return isRecord(value) && typeof value.name === 'string' && isRecord(value.args)
}

function parseToolCalls(value: unknown): ParsedToolCall[] {
  if (!Array.isArray(value)) return []
  return value.filter(isToolCall).map(call => ({
    id: call.id ?? '',
    name: call.name,
    args: toJsonSafe(call.args)
  }))
}

export function createSseResponse(
  threadId: string,
  streamPromise: Promise<AsyncIterable<StreamItem>>,
  options: StreamOptions = {}
) {
  const encoder = new TextEncoder()

  const responseStream = new ReadableStream({
    async start(controller) {
      const send = (data: SSEData) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send({ type: 'thread', threadId })
        options.initialEvents?.forEach(send)

        const stream = await streamPromise
        for await (const [mode, payload] of stream) {
          console.log(mode, payload)
          if (mode === 'values') {
            if (!isRecord(payload)) continue
            const interrupts = payload.__interrupt__ as Interrupt<Record<string, unknown>>[] | undefined
            if (!Array.isArray(interrupts)) continue

            for (const item of interrupts) {
              if (!isRecord(item)) continue
              const id = typeof item.id === 'string' ? item.id : ''
              if (!id) continue
              const value = isRecord(item.value) ? item.value : {}
              const toolCalls = parseToolCalls(value.toolCalls ?? value.tool_calls)
              if (!toolCalls.length) continue

              send({ type: 'approval_required', interruptId: id, toolCalls })
            }
          }

          if (mode === 'tools' && isRecord(payload)) {
            if (payload.event === 'on_tool_start') {
              send({
                type: 'tool_start',
                id: payload.toolCallId,
                name: payload.name,
                input: toJsonSafe(payload.input)
              })
            } else if (payload.event === 'on_tool_end') {
              send({
                type: 'tool_end',
                id: payload.toolCallId,
                name: payload.name,
                output: toJsonSafe(payload.output)
              })
            } else if (payload.event === 'on_tool_error') {
              send({
                type: 'tool_error',
                id: payload.toolCallId,
                name: payload.name,
                error: toJsonSafe(payload.error)
              })
            } else {
              send({
                type: 'tool_event',
                id: payload.toolCallId,
                name: payload.name,
                data: toJsonSafe(payload.data)
              })
            }
          }

          if (mode === 'messages' && Array.isArray(payload)) {
            const [messageChunk] = payload
            if (AIMessageChunk.isInstance(messageChunk)) {
              send(messageChunk.toDict())
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
