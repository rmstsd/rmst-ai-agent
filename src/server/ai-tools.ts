import { systemPrompts } from '@/server/system-prompts'
import { createSkillsSystemPrompt, loadSkills } from '@/skills/load'
import { getAllAiTools } from './tools'

export async function loadAiCapabilities() {
  const tools = getAllAiTools()
  const skills = await loadSkills()

  const duplicatedNames = tools.map(tool => tool.name).filter((name, index, names) => names.indexOf(name) !== index)
  if (duplicatedNames.length > 0) {
    throw new Error(`AI 工具名称重复：${[...new Set(duplicatedNames)].join(', ')}`)
  }

  return {
    systemPrompts: [...systemPrompts, createSkillsSystemPrompt(skills)],
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
