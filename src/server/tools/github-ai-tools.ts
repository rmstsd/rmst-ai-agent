import type { AiToolDefinition } from '@/server/tools/tool-types'
import { emptyParameters, objectParameters, stringProperty } from '@/server/tools/tool-types'

const repoProperty = stringProperty('GitHub 仓库名称，不包含 owner')
const repoParameters = objectParameters({ repo: repoProperty }, ['repo'])

export const githubAiTools: AiToolDefinition[] = [
  {
    name: 'setRepoPrivate',
    description: '设置 github 仓库为私有或者公开',
    parameters: objectParameters(
      {
        repo: stringProperty('repo 名称'),
        visibility: stringProperty('仓库可见性。public 或 private')
      },
      ['repo', 'visibility']
    ),
    executor: setRepoPrivate
  },
  {
    name: 'listRepos',
    description: '列出当前 GitHub 账号拥有的全部仓库，按最近更新时间倒序排列',
    parameters: emptyParameters,
    executor: listRepos
  },
  {
    name: 'getRepoInfo',
    description: '查询 GitHub 仓库的基本信息、可见性、默认分支和统计数据',
    parameters: repoParameters,
    executor: getRepoInfo
  },
  {
    name: 'listRepoBranches',
    description: '查询 GitHub 仓库的全部分支及其最新提交 SHA',
    parameters: repoParameters,
    executor: listRepoBranches
  },
  {
    name: 'listRepoCommits',
    description: '查询 GitHub 仓库指定分支最近的 10 条提交，不传分支时查询默认分支',
    parameters: objectParameters(
      {
        repo: repoProperty,
        branch: stringProperty('分支名称，可不传')
      },
      ['repo']
    ),
    executor: listRepoCommits
  }
]

import { Octokit } from 'octokit'

const octokit = new Octokit({
  auth: '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'
})

/** 当前 GitHub 工具仅操作该账号下的仓库。 */
const owner = 'rmstsd'
const githubApiHeaders = {
  'X-GitHub-Api-Version': '2026-03-10'
}

/** 修改指定仓库的公开或私有状态。 */
async function setRepoPrivate({ repo, visibility }: { repo: string; visibility: 'public' | 'private' }) {
  const { data } = await octokit.rest.repos.update({
    owner: owner,
    repo,
    visibility,
    headers: githubApiHeaders
  })

  console.log(`仓库  ${data.full_name} 当前可见性：${data.visibility}`)
}

/** 分页查询当前账号拥有的全部仓库，不包含组织或协作仓库。 */
async function listRepos() {
  const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    affiliation: 'owner',
    sort: 'updated',
    direction: 'desc',
    per_page: 100,
    headers: githubApiHeaders
  })

  return JSON.stringify(
    repos
      .filter(repo => repo.owner.login.toLowerCase() === owner.toLowerCase())
      .map(repo => ({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        visibility: repo.visibility,
        defaultBranch: repo.default_branch,
        archived: repo.archived,
        url: repo.html_url,
        updatedAt: repo.updated_at
      }))
  )
}

/** 查询仓库概况，并转换为适合作为工具输出的 JSON 字符串。 */
async function getRepoInfo({ repo }: { repo: string }) {
  const { data } = await octokit.rest.repos.get({
    owner,
    repo,
    headers: githubApiHeaders
  })

  return JSON.stringify(data)
}

/** 分页查询仓库的全部分支及每个分支的最新提交。 */
async function listRepoBranches({ repo }: { repo: string }) {
  const branches = await octokit.paginate(octokit.rest.repos.listBranches, {
    owner,
    repo,
    per_page: 100,
    headers: githubApiHeaders
  })

  return JSON.stringify(
    branches.map(branch => ({
      name: branch.name,
      sha: branch.commit.sha,
      protected: branch.protected
    }))
  )
}

/** 查询指定分支最近的 10 条提交；未指定分支时由 GitHub 使用默认分支。 */
async function listRepoCommits({ repo, branch }: { repo: string; branch?: string }) {
  const { data } = await octokit.rest.repos.listCommits({
    owner,
    repo,
    sha: branch,
    per_page: 10,
    headers: githubApiHeaders
  })

  return JSON.stringify(
    data.map(commit => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author?.name,
      authorLogin: commit.author?.login,
      authoredAt: commit.commit.author?.date,
      url: commit.html_url
    }))
  )
}

/** AI 工具名去掉 git_ 前缀后，通过该映射找到具体实现。 */
const githubToolsMap = {
  setRepoPrivate,
  listRepos,
  getRepoInfo,
  listRepoBranches,
  listRepoCommits
}
