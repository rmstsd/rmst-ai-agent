import { AIMessage, ToolMessage, type ToolCall } from '@langchain/core/messages'
import { Command, END, type GraphNode, MemorySaver, MessagesAnnotation, START, StateGraph, interrupt } from '@langchain/langgraph'

import { ChatDeepSeek } from '@langchain/deepseek'
import { agentAutoExecute } from './autoExecute/route'
import { executeToolsNode, tools } from './tool'

export type ApprovalRequest = {
  type: 'rmst-tool_approval'
  toolCalls: ApprovalToolCall[]
}

type ApprovalToolCall = Pick<ToolCall, 'args' | 'name'> & { id: string }

type ApprovalResponse = {
  approved: boolean
}

const checkpointer = new MemorySaver()
const State = MessagesAnnotation

export type State = typeof MessagesAnnotation.State

const model = new ChatDeepSeek({
  apiKey: 'sk-c948ff9124414de5b604aeb0e41e26df',
  model: 'deepseek-v4-flash',
  configuration: {
    baseURL: 'https://api.deepseek.com'
  },
  streaming: true,
  reasoning: { effort: 'none' }
})
const modelWithTools = model.bindTools(tools)

const callModelNode: GraphNode<typeof State> = async state => ({
  messages: [await modelWithTools.invoke(state.messages)]
})

const approvalNode: GraphNode<typeof State> = async state => {
  const lastMessage = state.messages.at(-1)
  if (!AIMessage.isInstance(lastMessage) || !lastMessage.tool_calls?.length) {
    return new Command({ goto: END })
  }

  if (!agentAutoExecute) {
    const toolCalls = lastMessage.tool_calls.map(call => ({
      id: call.id ?? '',
      name: call.name,
      args: call.args
    }))
    const approval = interrupt<ApprovalRequest, ApprovalResponse>({
      type: 'rmst-tool_approval',
      toolCalls
    })

    if (!approval?.approved) {
      return new Command({
        update: {
          messages: toolCalls.map(
            call => new ToolMessage({ tool_call_id: call.id, content: '工具调用已被人工拒绝', status: 'error' })
          )
        },
        goto: 'callModel'
      })
    }
  }

  return new Command({ goto: 'rmst_tool' })
}

export const graph = new StateGraph(State)
  .addNode('callModel', callModelNode)
  .addNode('rmst_tool', executeToolsNode)
  .addNode('rmst_approval_node', approvalNode, {
    ends: ['rmst_tool', 'callModel', END]
  })
  .addEdge(START, 'callModel')
  .addConditionalEdges(
    'callModel',
    state => {
      const lastMessage = state.messages.at(-1)
      return AIMessage.isInstance(lastMessage) && lastMessage.tool_calls?.length ? 'rmst_approval_node' : END
    },
    ['rmst_approval_node', END]
  )
  .addEdge('rmst_tool', 'callModel')
  .compile({ checkpointer })

export type ChatStreamPromise = ReturnType<
  typeof graph.stream<['messages', 'tools', 'updates', 'values', 'tasks'], false, undefined>
>

export function getThreadConfig(threadId: string) {
  return { configurable: { thread_id: threadId } }
}
