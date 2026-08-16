import { systemPrompts } from '@/server/system-prompts'
import { getAllAiTools } from './tools'

export async function loadAiCapabilities() {
  const tools = getAllAiTools()

  const registeredNames = new Set(tools.map(tool => tool.name))
  const unavailableTools = tools.filter(tool => !registeredNames.has(tool.name))
  if (unavailableTools.length > 0) {
    throw new Error(`未注册以下 AI 工具：${unavailableTools.map(tool => tool.name).join(', ')}`)
  }

  return {
    systemPrompts: [...systemPrompts],
    tools: tools.map(({ name, description, parameters }) => ({
      type: 'function',
      name,
      description,
      parameters
    }))
  }
}

export async function executeTool(name: string, args?: string) {
  console.log('executeTool', name, args)

  const tools = getAllAiTools()
  const tool = tools.find(tool => tool.name === name)

  try {
    if (tool?.executor) {
      return await tool.executor(JSON.parse(args || '{}'))
    }
    // return await executeM4Tool(name, args)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return `Failed to call function, error is ${message}`
  }
}
