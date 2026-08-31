import { deleteSession, getSessionSnapshot, updateSession } from '@/server/langchain-agent'
import { z } from 'zod'

export const runtime = 'nodejs'

const requestSchema = z.object({ title: z.string().trim().min(1).max(120) })

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
    await deleteSession((await context.params).sessionId)
    return Response.json({ ok: true })
  } catch (error) {
    console.error('[API /api/ai/session/:sessionId] 删除会话失败', error)
    return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 404 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const sessionId = (await context.params).sessionId
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: '请求参数不正确' }, { status: 400 })
  }
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return Response.json({ message: '请求参数不正确' }, { status: 400 })
  try {
    const session = updateSession(sessionId, parsed.data)
    return session ? Response.json({ session }) : Response.json({ message: '会话不存在' }, { status: 404 })
  } catch (error) {
    console.error('[API /api/ai/session/:sessionId] 更新会话失败', { sessionId, error })
    return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 404 })
  }
}
