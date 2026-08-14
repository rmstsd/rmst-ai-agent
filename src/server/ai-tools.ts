import { executeM4Tool, getM4Capabilities } from '@/server/m4-client'
import { fleetAiTools } from '@/server/tools/fleet-ai-tools'
import { logAiTools } from '@/server/tools/log-ai-tools'
import { storeAiTools } from '@/server/tools/store-ai-tools'
import { systemPrompts } from '@/server/system-prompts'
import { writeFileSync } from 'fs'
import { githubAiTools, GithubCapabilities } from './tools/github-ai-tools'
import { githubToolsMap } from './github/server'

const tools = [...logAiTools, ...fleetAiTools, ...storeAiTools, ...githubAiTools]

export async function loadAiCapabilities() {
  const remoteCapabilities = await getM4Capabilities()

  remoteCapabilities.tools.push(...GithubCapabilities.tools)

  writeFileSync('m4-capabilities.json', JSON.stringify(remoteCapabilities, null, 2))
  const registeredNames = new Set(remoteCapabilities.tools.map(tool => tool.name))
  const unavailableTools = tools.filter(tool => !registeredNames.has(tool.name))
  if (unavailableTools.length > 0) {
    throw new Error(`M4 未注册以下 AI 工具：${unavailableTools.map(tool => tool.name).join(', ')}`)
  }

  const dynamicPrompts = remoteCapabilities.systemPrompts.filter(prompt => prompt.startsWith('有以下机器人：'))

  return {
    systemPrompts: [...systemPrompts, ...dynamicPrompts],
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

  try {
    if (name.startsWith('git_')) {
      name = name.replace('git_', '')
      return await githubToolsMap[name](JSON.parse(args || '{}'))
    }

    return await executeM4Tool(name, args)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return `Failed to call function, error is ${message}`
  }
}
