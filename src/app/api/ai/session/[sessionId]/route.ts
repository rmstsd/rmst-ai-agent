import { getSessionSnapshot, stopSession } from '@/server/langchain-agent'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const sessionId = (await context.params).sessionId
  try {
    return Response.json(await getSessionSnapshot(sessionId))
  } catch (error) {
    console.error('[API /api/ai/session/:sessionId] 获取会话状态失败', { sessionId, error })
    return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 404 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    stopSession((await context.params).sessionId)
    return Response.json({ ok: true })
  } catch (error) {
    console.error('[API /api/ai/session/:sessionId] 删除会话失败', error)
    return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 404 })
  }
}
