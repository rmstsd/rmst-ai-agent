import { getConversationHistory } from '@/server/langchain-agent'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestSchema = z.object({ sessionId: z.string().min(1) })

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    console.log('[API /api/ai/history] 解析请求体失败', error)
    return Response.json({ message: '请求参数不正确' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return Response.json({ message: '请求参数不正确' }, { status: 400 })

  try {
    return Response.json(await getConversationHistory(parsed.data.sessionId))
  } catch (error) {
    console.log('[API /api/ai/history] 获取会话历史失败', error)
    return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
