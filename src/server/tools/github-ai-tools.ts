import type { AiToolDefinition } from '@/server/tools/tool-types'
import { emptyParameters, objectParameters, stringProperty } from '@/server/tools/tool-types'
import type { M4Capabilities } from '@/server/m4-client'

const repoProperty = stringProperty('GitHub 仓库名称，不包含 owner')
const repoParameters = objectParameters({ repo: repoProperty }, ['repo'])

export const githubAiTools: AiToolDefinition[] = [
  {
    name: 'git_setRepoPrivate',
    description: '设置 github 仓库为私有或者公开',
    parameters: objectParameters(
      {
        repo: stringProperty('repo 名称'),
        visibility: stringProperty('仓库可见性。public 或 private')
      },
      ['repo', 'visibility']
    )
  },
  {
    name: 'git_listRepos',
    description: '列出当前 GitHub 账号拥有的全部仓库，按最近更新时间倒序排列',
    parameters: emptyParameters
  },
  {
    name: 'git_getRepoInfo',
    description: '查询 GitHub 仓库的基本信息、可见性、默认分支和统计数据',
    parameters: repoParameters
  },
  {
    name: 'git_listRepoBranches',
    description: '查询 GitHub 仓库的全部分支及其最新提交 SHA',
    parameters: repoParameters
  },
  {
    name: 'git_listRepoCommits',
    description: '查询 GitHub 仓库指定分支最近的 10 条提交，不传分支时查询默认分支',
    parameters: objectParameters(
      {
        repo: repoProperty,
        branch: stringProperty('分支名称，可不传')
      },
      ['repo']
    )
  }
]

export const GithubCapabilities: M4Capabilities = {
  systemPrompts: [],
  tools: githubAiTools,
  hotWords: []
}
