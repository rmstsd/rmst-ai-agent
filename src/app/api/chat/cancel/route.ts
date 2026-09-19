import { cancelExecution } from '../execution'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { threadId?: string }
  const threadId = body.threadId?.trim()
  if (!threadId) {
    return Response.json({ error: 'threadId 参数必填' }, { status: 400 })
  }

  return Response.json({ cancelled: cancelExecution(threadId) })
}
