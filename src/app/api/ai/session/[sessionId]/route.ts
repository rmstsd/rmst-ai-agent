import { getSessionMessages } from '@/server/ark-client'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params
    return Response.json(getSessionMessages(sessionId))
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 404 })
  }
}
