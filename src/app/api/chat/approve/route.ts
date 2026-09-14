import { Command } from '@langchain/langgraph'
import { graph, getThreadConfig } from '../graph'
import { createSseResponse } from '../stream'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { threadId?: string; approved?: boolean }
  const threadId = body.threadId?.trim()
  if (!threadId || typeof body.approved !== 'boolean') {
    return Response.json({ error: 'threadId 和 approved 参数必填' }, { status: 400 })
  }

  const config = getThreadConfig(threadId)

  const streamPromise = graph.stream(
    new Command({
      resume: { approved: body.approved }
    }),
    {
      ...config,
      streamMode: ['messages', 'tools', 'values']
    }
  )

  return createSseResponse(threadId, streamPromise)
}
