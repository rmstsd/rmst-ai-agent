import { resolveToolApproval } from '@/server/ag-demo/agent-core'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '请求体必须是合法的 JSON' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return Response.json({ error: '请求体必须是 JSON 对象' }, { status: 400 })
  }

  const payload = body as {
    sessionId?: unknown
    approvalId?: unknown
    approved?: unknown
  }

  if (
    typeof payload.sessionId !== 'string' ||
    typeof payload.approvalId !== 'string' ||
    typeof payload.approved !== 'boolean'
  ) {
    return Response.json({ error: 'sessionId、approvalId 和 approved 参数无效' }, { status: 400 })
  }

  const resolved = resolveToolApproval(payload.sessionId, payload.approvalId, payload.approved)
  if (!resolved) {
    return Response.json({ error: '审批不存在、已处理或不属于当前会话' }, { status: 404 })
  }

  return Response.json({ ok: true })
}
