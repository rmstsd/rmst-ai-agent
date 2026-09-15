import { AIMessage, AIMessageChunk } from '@langchain/core/messages'
import type { ToolMessage } from '@langchain/core/messages'
import { INTERRUPT, isInterrupted } from '@langchain/langgraph'
import type { ApprovalRequest, ChatStreamPromise } from './graph'
import type { ChatStreamEvent, UiToolCall } from '@/app/type'

export function createSseResponse(threadId: string, streamPromise: ChatStreamPromise) {
  const encoder = new TextEncoder()

  const responseStream = new ReadableStream({
    async start(controller) {
      const send = (data: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send({ type: 'thread', threadId })

        const stream = await streamPromise
        for await (const [mode, payload] of stream) {
          if (mode === 'values') {
            // 也可以在 'updates' 里监听中断
            if (!isInterrupted<ApprovalRequest>(payload)) continue
            const interrupts = payload[INTERRUPT]

            for (const item of interrupts) {
              const value = item.value!

              send({ type: 'rmst_approval_required', id: item.id ?? crypto.randomUUID(), toolCalls: value.toolCalls })
            }
          }

          if (mode === 'updates') {
            console.log('updates', payload)
            const lastMessage = payload.callModel?.messages?.at(-1)
            const toolCallMessage = AIMessage.isInstance(lastMessage) && lastMessage.tool_calls?.length ? lastMessage : null

            if (toolCallMessage) {
              const toolCalls = (toolCallMessage.tool_calls ?? []).map(toolCall => ({
                id: toolCall.id!,
                name: toolCall.name,
                args: toolCall.args
              }))

              send({ type: 'tool_calls', id: `tools-${toolCallMessage.id}`, toolCalls })
            }
          }

          if (mode === 'tools') {
            if (payload.event === 'on_tool_start') {
              if (!payload.toolCallId) continue

              send({
                type: 'tool_start',
                id: payload.toolCallId
              })
            } else if (payload.event === 'on_tool_end') {
              if (!payload.toolCallId) continue

              const output = payload.output as ToolMessage
              send({
                type: 'tool_end',
                id: payload.toolCallId,
                name: payload.name,
                output: output.content
              })
            } else if (payload.event === 'on_tool_error') {
              if (!payload.toolCallId) continue

              const error = payload.error as Error
              send({
                type: 'tool_error',
                id: payload.toolCallId,
                name: payload.name,
                error: error.message
              })
            }
          }

          if (mode === 'messages') {
            const [messageChunk] = payload
            if (AIMessageChunk.isInstance(messageChunk)) {
              if (messageChunk.text && messageChunk.id) {
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
        console.log('error', error)
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
