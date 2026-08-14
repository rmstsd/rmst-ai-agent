import { createSession } from '@/server/ark-client'
import { setRepoPrivate } from '@/server/github/server'

export const runtime = 'nodejs'

export async function POST() {
  setRepoPrivate('rmst-sd')
  try {
    return Response.json({ sessionId: await createSession() })
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
