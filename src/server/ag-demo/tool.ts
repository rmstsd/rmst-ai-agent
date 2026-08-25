import { exec } from 'node:child_process'
import { loadSkillContent } from './skill'
import { readFile } from 'node:fs/promises'

type ToolArguments = Record<string, unknown>

type ToolDefinition = {
  type: 'function'
  name: string
  description: string
  parameters: Record<string, unknown>
  executor: (args: ToolArguments) => Promise<unknown> | unknown
}

const tools: ToolDefinition[] = [
  {
    type: 'function',
    name: 'get_weather',
    description: '根据城市名称查询该城市当日天气（含温度、天气状况）',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: '城市名称，如北京、上海（仅支持国内地级市）'
        }
      },
      required: ['location']
    },
    executor: async (_args: ToolArguments) => {
      return '今天晴.温度25摄氏度'
    }
  },
  {
    type: 'function',
    name: 'load-skill',
    description: '加载指定 skill.md 文件的内容',
    parameters: {
      type: 'object',
      properties: {
        skillName: {
          type: 'string',
          description: '技能名称'
        }
      },
      required: ['skillName']
    },
    executor: async (_args: ToolArguments) => {
      const skillName = _args.skillName as string
      return await loadSkillContent(skillName)
    }
  },
  {
    type: 'function',
    name: 'read-skill-doc',
    description: '当需要读取指定 skill 里的其他文件的内容时, 调用此工具',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件的路径'
        }
      },
      required: ['path']
    },
    executor: async (_args: ToolArguments) => {
      const path = _args.path as string
      return await readFile(path, 'utf-8')
    }
  },
  {
    type: 'function',
    name: 'http-request',
    description: '发送 HTTP 请求',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '请求 URL'
        },
        method: {
          type: 'string',
          description: '请求方法，如 GET、POST、PUT 等'
        },
        headers: {
          type: 'object',
          description: '请求头，键值对格式'
        },
        body: {
          type: 'string',
          description: '请求体，JSON 字符串格式'
        },
        params: {
          type: 'object',
          description: '查询参数，键值对格式'
        }
      },
      required: ['url']
    },
    executor: async (_args: {
      url: string
      method: string
      headers: Record<string, string>
      body: string
      params: Record<string, string>
    }) => {
      let { url, method, headers, body, params } = _args

      if (method === 'GET' && params) {
        const searchParams = new URLSearchParams(params)
        url += `?${searchParams.toString()}`
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(JSON.parse(body)) : undefined
      })
      return await response.text()
    }
  },
  {
    type: 'function',
    name: 'exec-shell',
    description: '执行 shell 命令',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'shell 命令字符串'
        }
      },
      required: ['command']
    },
    executor: async (_args: ToolArguments) => {
      const command = _args.command as string

      if (!command || !command.trim()) {
        throw new Error('shell 命令不能为空')
      }

      // 执行 shell 命令，并将回调结果转换为 Promise，便于统一处理工具调用。
      return await new Promise<string>((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          const output = [stdout, stderr].filter(Boolean).join('\n')

          if (error) {
            reject(new Error(output.trim() || error.message))
            return
          }

          resolve(output)
        })
      })
    }
  }
]

export const toolsList = tools.map(item => ({
  type: item.type,
  name: item.name,
  description: item.description,
  parameters: item.parameters
}))

async function executeTool(name: string, args: unknown) {
  const tool = tools.find(item => item.name === name)
  if (!tool) {
    throw new Error(`未注册的工具：${name}`)
  }

  const toolArgs = typeof args === 'object' && args !== null && !Array.isArray(args) ? (args as ToolArguments) : {}

  return tool.executor(toolArgs)
}

function serializeToolOutput(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export type ToolCall = {
  callId: string
  itemId?: string
  name: string
  arguments: string
}

export async function executeToolCall(toolCall: ToolCall, approved: boolean) {
  let args: unknown = {}
  let output: string

  if (!approved) {
    output = '用户拒绝执行该工具'
    return {
      call: toolCall,
      output,
      input: { type: 'function_call_output' as const, call_id: toolCall.callId, output }
    }
  }

  try {
    args = toolCall.arguments ? JSON.parse(toolCall.arguments) : {}
  } catch {
    return {
      call: toolCall,
      output: '工具参数不是合法的 JSON',
      input: { type: 'function_call_output' as const, call_id: toolCall.callId, output: '工具参数不是合法的 JSON' }
    }
  }

  try {
    const result = await executeTool(toolCall.name, args)
    output = serializeToolOutput(result)
  } catch (error) {
    output = error instanceof Error ? `工具执行失败：${error.message}` : '工具执行失败'
  }

  return {
    call: toolCall,
    output,
    input: { type: 'function_call_output' as const, call_id: toolCall.callId, output }
  }
}

export function createApprovalId() {
  return `approval-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
