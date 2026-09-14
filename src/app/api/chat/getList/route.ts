import type { BaseMessage } from '@langchain/core/messages'
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages'
import { NextResponse } from 'next/server'
import type { ChatListResponse, UiMessage, UiToolCall } from '@/app/type'
import type { ApprovalRequest } from '../graph'
import { graph, getThreadConfig } from '../graph'
import { StateSnapshot } from '@langchain/langgraph'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { threadId?: string }
  const threadId = body.threadId?.trim()
  if (!threadId) {
    return NextResponse.json({ error: 'threadId 参数必填' }, { status: 400 })
  }

  const config = getThreadConfig(threadId)
  const state = await graph.getState(config)
  console.log('state', state)
  const stateMessages = (state.values.messages ?? []) as BaseMessage[]
  const pendingToolCallIds = getPendingToolCallIds(state)

  const data: ChatListResponse = {
    messages: mapStateToUiMessages(stateMessages, pendingToolCallIds),
    needApproval: pendingToolCallIds.size > 0
  }

  return NextResponse.json(data)
}

function getPendingToolCallIds(state: StateSnapshot) {
  const toolCallIds = new Set<string>()

  for (const task of state.tasks) {
    for (const item of task.interrupts) {
      const request = item.value as ApprovalRequest

      if (request.type === 'rmst-tool_approval') {
        for (const toolCall of item.value.toolCalls) {
          toolCallIds.add(toolCall.id)
        }
      }
    }
  }

  return toolCallIds
}

function mapStateToUiMessages(stateMessages: BaseMessage[], pendingToolCallIds: Set<string>): UiMessage[] {
  const toolResults = new Map<string, ToolMessage>()

  for (const message of stateMessages) {
    if (ToolMessage.isInstance(message)) {
      toolResults.set(message.tool_call_id, message)
    }
  }

  return stateMessages.flatMap((message, index) => {
    const messageId = message.id ?? `message-${index}`

    if (HumanMessage.isInstance(message)) {
      return [{ id: messageId, type: 'user', content: message.text } satisfies UiMessage]
    }

    if (!AIMessage.isInstance(message)) return []

    const uiMessages: UiMessage[] = []
    if (message.text) {
      uiMessages.push({ id: messageId, type: 'ai', content: message.text })
    }

    if (message.tool_calls?.length) {
      const toolCalls: UiToolCall[] = message.tool_calls.map(toolCall => {
        const toolCallId = toolCall.id ?? ''
        const result = toolResults.get(toolCallId)
        const status = result
          ? result.status === 'error'
            ? 'error'
            : 'success'
          : pendingToolCallIds.has(toolCallId)
            ? 'approval_required'
            : 'pending'

        return {
          id: toolCallId,
          name: toolCall.name,
          args: toolCall.args,
          status,
          ...(result ? { content: result.text } : {}),
          ...(result?.status === 'error' ? { error: result.text } : {})
        }
      })

      uiMessages.push({
        id: `tools-${messageId}`,
        type: 'tool',
        toolCalls
      })
    }

    return uiMessages
  })
}
