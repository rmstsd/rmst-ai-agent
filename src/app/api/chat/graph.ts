import { AIMessage, ToolMessage } from '@langchain/core/messages'
import { Command, END, GraphNode, MemorySaver, MessagesAnnotation, START, StateGraph, interrupt } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { ChatOpenAI } from '@langchain/openai'
import { Tool, tool, ToolCall } from 'langchain'
import { z } from 'zod'
import { ChatDeepSeek } from '@langchain/deepseek'
import { agentAutoExecute } from './autoExecute/route'

export type ApprovalRequest = {
  type: 'rmst-tool_approval'
  toolCalls: ToolCall[]
}

type ApprovalResponse = {
  approved: boolean
}

const checkpointer = new MemorySaver()

const model = new ChatDeepSeek({
  apiKey: 'sk-c948ff9124414de5b604aeb0e41e26df',
  model: 'deepseek-v4-flash',
  configuration: {
    baseURL: 'https://api.deepseek.com'
  },
  streaming: true,
  reasoning: { effort: 'none' }
})

const getWeather = tool(
  async ({ location }) => {
    if (location === '上海') {
      throw new Error('不支持上海')
    }

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

const callModel: GraphNode<State> = async (state: State) => ({
  messages: [await modelWithTools.invoke(state.messages)]
})

const State = MessagesAnnotation
type State = typeof MessagesAnnotation.State

const approvalNode: GraphNode<State> = async state => {
  const lastMessage = state.messages.at(-1) as AIMessage

  if (!agentAutoExecute) {
    const toolCalls = (lastMessage.tool_calls ?? []).map(call => ({
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
  .addNode('callModel', callModel)
  .addNode('rmst_tool', new ToolNode([getWeather], { handleToolErrors: false }), {
    retryPolicy: {
      maxAttempts: 3,
      retryOn: error => {
        console.log(1)
        return error instanceof Error
      }
    },
    errorHandler: (state: State, nodeError) => {
      console.log('nodeError', nodeError)
      const lastMessage = state.messages.at(-1) as AIMessage

      return new Command({
        goto: 'callModel',
        update: {
          messages: (lastMessage.tool_calls ?? []).map(
            item =>
              new ToolMessage({
                tool_call_id: item.id ?? '',
                name: item.name,
                content: '工具调用失败 aa',
                status: 'error'
              })
          )
        }
      })
    }
  })
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
