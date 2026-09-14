import { NextResponse } from 'next/server'

export let agentAutoExecute = false

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { autoExecute: boolean }

  agentAutoExecute = body.autoExecute

  return NextResponse.json({})
}
