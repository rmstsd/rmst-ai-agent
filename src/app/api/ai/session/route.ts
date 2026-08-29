import { createSession } from '@/server/langchain-agent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    return Response.json({ sessionId: createSession() })
  } catch (error) {
    console.error('[API /api/ai/session] 创建会话失败', error)
    return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
