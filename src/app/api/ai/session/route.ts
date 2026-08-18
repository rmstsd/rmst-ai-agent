import { createSession, listSessions } from '@/server/ark-client'

export const runtime = 'nodejs'

export async function GET() {
  return Response.json({ sessions: listSessions() })
}

export async function POST() {
  try {
    return Response.json({ sessionId: await createSession() })
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
