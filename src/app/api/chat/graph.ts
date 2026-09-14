import { AIMessage, ToolMessage } from '@langchain/core/messages'
import { Command, END, MemorySaver, MessagesAnnotation, START, StateGraph, interrupt } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { ChatOpenAI } from '@langchain/openai'
import { tool, ToolCall } from 'langchain'
import { z } from 'zod'
import { ChatDeepSeek } from '@langchain/deepseek'
import { agentAutoExecute } from './autoExecute/route'

export type ApprovalRequest = {
  type: 'rmst-tool_approval'
  toolCalls: ToolCall[]
}

export type ApprovalResponse = {
  approved: boolean
}

export const checkpointer = new MemorySaver()

const model = new ChatDeepSeek({
  apiKey: 'sk-c948ff9124414de5b604aeb0e41e26df',
  model: 'deepseek-v4-flash',
  configuration: {
    baseURL: 'https://api.deepseek.com'
  },
  streaming: true,
  reasoning: { effort: 'none' }
})

export const getWeather = tool(
  async ({ location }) => {
    await new Promise(resolve => setTimeout(resolve, 2000))
    return `当前${location}的天气是晴朗`
  },
  {
    name: 'get_weather',
    description: '获取天气信息',
    schema: z.object({ location: z.string().describe('城市名称') })
  }
)

const modelWithTools = model.bindTools([getWeather])
const toolNode = new ToolNode([getWeather])

const callModel = async (state: State) => ({
  messages: [await modelWithTools.invoke(state.messages)]
})

const approvalToolNode = async (state: State) => {
  const lastMessage = state.messages.at(-1)
  if (!AIMessage.isInstance(lastMessage) || !lastMessage.tool_calls?.length) {
    return { messages: [] }
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
      return {
        messages: toolCalls.map(
          call => new ToolMessage({ tool_call_id: call.id, content: '工具调用已被人工拒绝', status: 'error' })
        )
      }
    }
  }

  return toolNode.invoke(state)
}

const State = MessagesAnnotation
type State = typeof MessagesAnnotation.State

export const graph = new StateGraph(State)
  .addNode('callModel', callModel)
  .addNode('rmst_tool', approvalToolNode)
  .addEdge(START, 'callModel')
  .addConditionalEdges(
    'callModel',
    state => {
      const lastMessage = state.messages.at(-1)
      return AIMessage.isInstance(lastMessage) && lastMessage.tool_calls?.length ? 'rmst_tool' : END
    },
    ['rmst_tool', END]
  )
  .addEdge('rmst_tool', 'callModel')
  .compile({ checkpointer })

export type ChatStreamPromise = ReturnType<
  typeof graph.stream<['messages', 'tools', 'updates', 'values', 'tasks'], false, undefined>
>

export function getThreadConfig(threadId: string) {
  return { configurable: { thread_id: threadId } }
}
