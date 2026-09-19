import { HumanMessage } from '@langchain/core/messages'
import { startExecution } from './execution'
import { graph, getThreadConfig } from './graph'
import { createSseResponse } from './stream'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { message?: string; threadId?: string }
  const userMessage = body.message?.trim() || '沈阳和上海天气如何'
  const threadId = body.threadId?.trim() || crypto.randomUUID()
  const config = getThreadConfig(threadId)
  const execution = startExecution(threadId, request.signal)

  const streamPromise = graph.stream(
    { messages: [new HumanMessage(userMessage)] },
    { ...config, signal: execution.signal, streamMode: ['messages', 'tools', 'updates', 'values', 'tasks'] }
  )

  //  const s =  await streamPromise
  //  s.cancel()

  return createSseResponse(threadId, streamPromise, execution.signal, execution.release)
}
