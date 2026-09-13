import { AIMessageChunk } from '@langchain/core/messages'

type SSEData = unknown

type StreamItem = readonly [string, unknown]

type StreamOptions = {
  initialEvents?: SSEData[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

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

function parseToolCalls(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map(call => ({
    id: typeof call.id === 'string' ? call.id : '',
    name: typeof call.name === 'string' ? call.name : '工具',
    args: call.args
  }))
}

export function createSseResponse(threadId: string, streamPromise: Promise<AsyncIterable<StreamItem>>, options: StreamOptions = {}) {
  const encoder = new TextEncoder()

  const responseStream = new ReadableStream({
    async start(controller) {
      const send = (data: SSEData) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const sentInterruptIds = new Set<string>()

      try {
        send({ type: 'thread', threadId })
        options.initialEvents?.forEach(send)

        const stream = await streamPromise
        for await (const item of stream) {
          const mode = item[0]
          const payload = item[1]

          console.log(mode, payload)
          if (mode === 'values') {
            if (!isRecord(payload)) continue
            const interrupts = payload.__interrupt__
            if (!Array.isArray(interrupts)) continue

            for (const item of interrupts) {
              if (!isRecord(item)) continue
              const id = typeof item.id === 'string' ? item.id : ''
              const value = isRecord(item.value) ? item.value : {}
              const toolCalls = parseToolCalls(value.toolCalls ?? value.tool_calls)
              if (!toolCalls.length) continue
              const eventId = id || JSON.stringify(toolCalls)
              if (sentInterruptIds.has(eventId)) continue
              sentInterruptIds.add(eventId)
              send({ type: 'approval_required', interruptId: id || undefined, toolCalls })
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
