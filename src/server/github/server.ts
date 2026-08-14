import { Octokit } from 'octokit'

const octokit = new Octokit({
  auth: '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'
})

const owner = 'rmstsd'

export async function setRepoPrivate({ repo, visibility }: { repo: string; visibility: 'public' | 'private' }) {
  const { data } = await octokit.rest.repos.update({
    owner: owner,
    repo,
    visibility,
    headers: {
      'X-GitHub-Api-Version': '2026-03-10'
    }
  })

  console.log(`仓库  ${data.full_name} 当前可见性：${data.visibility}`)
}

export const githubToolsMap = {
  setRepoPrivate
}
