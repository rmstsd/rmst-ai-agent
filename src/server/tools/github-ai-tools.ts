import type { AiToolDefinition } from '@/server/tools/tool-types'
import { emptyParameters, objectParameters, stringProperty } from '@/server/tools/tool-types'
import { M4Capabilities } from '../m4-client'

export const githubAiTools: AiToolDefinition[] = [
  {
    name: 'git_setRepoPrivate',
    description: '设置 github 仓库为私有或者公开',
    parameters: objectParameters(
      {
        repo: stringProperty('repo 名称'),
        visibility: stringProperty('仓库可见性。public 或 private')
      },
      ['可见性']
    )
  }
]

export const GithubCapabilities: M4Capabilities = {
  systemPrompts: [],
  tools: [
    {
      name: 'git_setRepoPrivate',
      description: '设置 github 仓库为私有或者公开',
      parameters: {
        type: 'object',
        properties: {
          repo: {
            type: 'string',
            description: 'repo 名称'
          },
          visibility: {
            type: 'string',
            description: '仓库可见性。public 或 private'
          }
        },
        required: ['repo', 'visibility']
      }
    }
  ],
  hotWords: []
}
