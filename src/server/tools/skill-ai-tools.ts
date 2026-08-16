import { executeSkillTool } from '@/skills/load'
import type { AiToolDefinition } from '@/server/tools/tool-types'
import { objectParameters, stringProperty } from '@/server/tools/tool-types'

export const skillAiTools: AiToolDefinition[] = [
  {
    name: 'load-skill',
    description: '根据名称加载一个 Skill 的完整指令。仅在用户任务与可用 Skill 的描述匹配时调用。',
    parameters: objectParameters(
      {
        name: stringProperty('系统提示中列出的 Skill 名称')
      },
      ['name']
    ),
    executor: ({ name }) => executeSkillTool(name as string)
  }
]
