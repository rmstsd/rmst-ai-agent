import { createSession, listSessions } from '@/server/langchain-agent'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestSchema = z.object({ title: z.string().trim().max(120).optional() })

export async function GET() {
  try {
    return Response.json({ sessions: listSessions() })
  } catch (error) {
    console.error('[API /api/ai/session] 获取会话列表失败', error)
    return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return Response.json({ message: '请求参数不正确' }, { status: 400 })
  try {
    const sessionId = createSession(parsed.data.title)
    return Response.json({ sessionId, session: listSessions().find(session => session.id === sessionId) })
  } catch (error) {
    console.error('[API /api/ai/session] 创建会话失败', error)
    return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
