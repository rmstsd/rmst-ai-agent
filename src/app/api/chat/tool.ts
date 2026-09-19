import { AIMessage, ToolMessage, type ToolCall } from '@langchain/core/messages'
import { type GraphNode, type LangGraphRunnableConfig } from '@langchain/langgraph'
import { tool } from 'langchain'
import { z } from 'zod'
import { State } from './graph'

export class ToolCallError extends Error {
  constructor(
    message: string,
    readonly retryable = false
  ) {
    super(message)
    this.name = 'ToolCallError'
  }
}

const getWeather = tool(
  async ({ location }, runtime) => {
    console.log('runtime', runtime)
    if (location === '上海') {
      throw new ToolCallError('不支持上海')
    }

    if (location === '北京') {
      await new Promise(resolve => setTimeout(resolve, 2000))
      return `当前${location}的天气是下雪`
    }

    await new Promise(resolve => setTimeout(resolve, 4000))
    return `当前${location}的天气是晴朗`
  },
  {
    name: 'get_weather',
    description: '获取天气信息',
    schema: z.object({ location: z.string().describe('城市名称') })
  }
)

export const tools = [getWeather]
const toolsByName = new Map<string, typeof getWeather>(tools.map(currentTool => [currentTool.name, currentTool]))

const maxToolAttempts = 3
const initialRetryInterval = 500
const maxRetryInterval = 128_000
const retryBackoffFactor = 2

export const executeToolsNode: GraphNode<State> = async (state, config) => {
  const lastMessage = state.messages.at(-1)
  if (!AIMessage.isInstance(lastMessage) || !lastMessage.tool_calls?.length) {
    return { messages: [] }
  }

  return {
    messages: await Promise.all(lastMessage.tool_calls.map(toolCall => executeToolCall(toolCall, state, config)))
  }
}

async function executeToolCall(toolCall: ToolCall, state: State, config: LangGraphRunnableConfig): Promise<ToolMessage> {
  const currentTool = toolsByName.get(toolCall.name)
  if (!currentTool) {
    return createToolErrorMessage(toolCall, `Tool "${toolCall.name}" not found.`)
  }

  for (let attempt = 1; attempt <= maxToolAttempts; attempt += 1) {
    try {
      const output = await currentTool.invoke(toolCall)
      return ToolMessage.isInstance(output) ? output : createToolSuccessMessage(toolCall, output)
    } catch (error) {
      if (!(error instanceof ToolCallError) || !error.retryable || attempt === maxToolAttempts) {
        return createToolErrorMessage(toolCall, getErrorMessage(error))
      }

      const retryDelay = getRetryDelay(attempt)
      console.log(`Retrying tool "${toolCall.name}" after ${retryDelay.toFixed(2)}ms (attempt ${attempt})`)
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }

  return createToolErrorMessage(toolCall, '工具调用失败')
}

function createToolErrorMessage(toolCall: ToolCall, message: string) {
  return new ToolMessage({ tool_call_id: toolCall.id ?? '', name: toolCall.name, content: message, status: 'error' })
}

function createToolSuccessMessage(toolCall: ToolCall, output: unknown) {
  return new ToolMessage({
    tool_call_id: toolCall.id ?? '',
    name: toolCall.name,
    content: typeof output === 'string' ? output : JSON.stringify(output),
    status: 'success'
  })
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '未知错误'
}

function getRetryDelay(attempt: number) {
  const interval = Math.min(maxRetryInterval, initialRetryInterval * retryBackoffFactor ** (attempt - 1))
  return interval + Math.random() * 1_000
}
