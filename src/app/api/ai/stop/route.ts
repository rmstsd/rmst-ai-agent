import { stopSession } from '@/server/langchain-agent'
import { z } from 'zod'

export const runtime = 'nodejs'

const requestSchema = z.object({ sessionId: z.string().min(1) })

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    console.log('[API /api/ai/stop] 解析请求体失败', error)
    return Response.json({ message: '请求参数不正确' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return Response.json({ message: '请求参数不正确' }, { status: 400 })

  try {
    stopSession(parsed.data.sessionId)
    return Response.json({ ok: true })
  } catch (error) {
    console.log('[API /api/ai/stop] 停止会话失败', { sessionId: parsed.data.sessionId, error })
    return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 404 })
  }
}
