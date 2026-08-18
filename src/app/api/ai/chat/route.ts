import { streamUserMessage } from '@/server/ark-client'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestSchema = z
  .object({
    sessionId: z.string().min(1),
    message: z.string().trim().min(1).max(20_000)
  })
  .strict()

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json({ message: '请求参数不正确' }, { status: 400 })
  }

  try {
    return streamUserMessage(parsed.data.sessionId, parsed.data.message)
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
