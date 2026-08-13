import { stopSession } from '@/server/ark-client'
import { z } from 'zod'

export const runtime = 'nodejs'

const requestSchema = z.object({ sessionId: z.string().min(1) })

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json())
  if (!parsed.success) return Response.json({ message: '会话 ID 不正确' }, { status: 400 })

  try {
    stopSession(parsed.data.sessionId)
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 404 })
  }
}
