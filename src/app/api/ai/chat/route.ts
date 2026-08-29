import { streamAgentMessage } from '@/server/langchain-agent'
import type { ChatStreamEvent } from '@/types/ai'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().trim().min(1).max(20_000)
})

function createSseResponse(task: (send: (event: ChatStreamEvent) => void) => Promise<void>) {
  const encoder = new TextEncoder()
  let closed = false
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ChatStreamEvent) => {
        if (closed) return
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      task(send)
        .catch(error => {
          if (error instanceof Error && error.name === 'AbortError') return
          console.error('[API /api/ai/chat] 请求失败', error)
          send({ type: 'Error', message: error instanceof Error ? error.message : String(error) })
        })
        .finally(() => {
          if (closed) return
          closed = true
          controller.close()
        })
    },
    cancel() {
      // The client can cancel a fetch while the model is still producing tokens.
      closed = true
    }
  })

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8'
    }
  })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    console.error('[API /api/ai/chat] 解析请求体失败', error)
    return Response.json({ message: '请求参数不正确' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return Response.json({ message: '请求参数不正确' }, { status: 400 })

  return createSseResponse(send => streamAgentMessage(parsed.data.sessionId, parsed.data.message, request.signal, send))
}
