import { Octokit } from 'octokit'

const octokit = new Octokit({
  auth: ''
})

export async function setRepoPrivate(owner: string, repo: string) {
  const { data } = await octokit.rest.repos.update({
    owner: '你的 GitHub 用户名或组织名',
    repo: '仓库名称',
    private: true,
    headers: {
      'X-GitHub-Api-Version': '2026-03-10'
    }
  })

  console.log(`仓库 ${data.full_name} 已变为私有仓库`)
  console.log(`当前可见性：${data.visibility}`)
}
