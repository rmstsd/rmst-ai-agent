import { AgentCoreError, streamAgentConversation } from '@/server/ag-demo/agent-core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ChatRequestBody = {
  sessionId?: string
  message?: string
}

function createErrorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

function getRequestBody(body: unknown) {
  if (typeof body !== 'object' || body === null) {
    return { error: '请求体必须是 JSON 对象' } as const
  }

  const requestBody = body as ChatRequestBody
  if (typeof requestBody.sessionId !== 'string' || requestBody.sessionId.trim().length === 0) {
    return { error: 'sessionId 必须是非空字符串' } as const
  }

  if (typeof requestBody.message !== 'string' || requestBody.message.trim().length === 0 || requestBody.message.length > 20_000) {
    return { error: 'message 必须是非空字符串' } as const
  }

  return {
    sessionId: requestBody.sessionId.trim(),
    message: requestBody.message
  } as const
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return createErrorResponse('请求体必须是合法的 JSON', 400)
  }

  const requestBody = getRequestBody(body)
  if ('error' in requestBody) {
    return createErrorResponse(requestBody.error, 400)
  }

  try {
    return await streamAgentConversation({
      sessionId: requestBody.sessionId,
      message: requestBody.message,
      signal: request.signal
    })
  } catch (error) {
    if (error instanceof AgentCoreError) {
      return createErrorResponse(error.message, error.status)
    }

    return createErrorResponse('调用 Agent 失败', 502)
  }
}
