import { AIMessageChunk } from '@langchain/core/messages'
import type { ToolCall, ToolMessage } from '@langchain/core/messages'
import { INTERRUPT, isInterrupted } from '@langchain/langgraph'
import type { ApprovalRequest, ChatStreamPromise } from './graph'
import { UiMessage } from '@/app/type'

export function createSseResponse(threadId: string, streamPromise: ChatStreamPromise) {
  const encoder = new TextEncoder()

  const responseStream = new ReadableStream({
    async start(controller) {
      const send = (data: UiMessage) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send({ type: 'thread', threadId })

        const stream = await streamPromise
        for await (const [mode, payload] of stream) {
          if (mode === 'values') {
            if (!isInterrupted<ApprovalRequest>(payload)) continue
            const interrupts = payload[INTERRUPT]

            console.log('interrupts', interrupts)
            for (const item of interrupts) {
              const value = item.value!

              send({ type: 'approval_required', id: item.id, toolCalls: value.toolCalls })
            }
          }

          if (mode === 'tools') {
            console.log('tools', payload)
            if (payload.event === 'on_tool_start') {
              send({
                type: 'tool_start',
                id: payload.toolCallId
              })
            } else if (payload.event === 'on_tool_end') {
              const output = payload.output as ToolMessage
              send({
                type: 'tool_end',
                id: payload.toolCallId,
                name: payload.name,
                output: output.content
              })
            }
          }

          if (mode === 'messages') {
            const [messageChunk] = payload
            console.log('messageChunk', messageChunk)
            if (AIMessageChunk.isInstance(messageChunk)) {
              if (messageChunk.text) {
                send({
                  id: messageChunk.id,
                  type: 'ai',
                  content: messageChunk.text
                })
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
