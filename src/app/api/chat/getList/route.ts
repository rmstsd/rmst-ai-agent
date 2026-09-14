import { UiMessage } from '@/app/type'
import { graph, getThreadConfig } from '../graph'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { threadId: string }
  const threadId = body.threadId.trim()

  const config = getThreadConfig(threadId)

  const state = await graph.getState(config)
  console.log(state)

  const data = {
    tasks: state.tasks,
    messages: mapStateToUiMessages()
  }

  return NextResponse.json(data)

  function mapStateToUiMessages(): UiMessage[] {
    return state.values.messages.map((value: any) => ({
      id: value.id,
      type: value.type,
      content: value.content,
      tool_calls: value.tool_calls,
      tool_call_id: value.tool_call_id,
      name: value.name,
      args: value.args,
      status: value.status,
      input: value.input,
      error: value.error
    }))
  }
}
