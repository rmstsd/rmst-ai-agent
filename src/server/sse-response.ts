import type { ChatStreamEvent } from '@/types/ai'

export function createSseResponse(run: (send: (event: ChatStreamEvent) => void) => Promise<unknown>) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        await run(send)
      } catch (error) {
        const aborted = error instanceof Error && error.name === 'AbortError'
        send({
          type: 'Error',
          message: aborted ? '生成已停止' : error instanceof Error ? error.message : String(error)
        })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      'Content-Type': 'text/event-stream; charset=utf-8',
      Connection: 'keep-alive'
    }
  })
}
