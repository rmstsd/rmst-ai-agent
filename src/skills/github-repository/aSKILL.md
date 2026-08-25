---
name: github-repository
description: 管理当前账号拥有的 GitHub 仓库，包括列出仓库、查询仓库信息、查询分支和提交，以及修改仓库公开或私有状态。
compatibility: Requires Node.js 20+, TypeScript runtime, network access, and authenticated GitHub CLI.
---

# GitHub 仓库管理

所有 GitHub 操作统一通过 `scripts/github.ts` 执行。

## 可用命令

```text
npx tsx scripts/github.ts list-repos
npx tsx scripts/github.ts repo-info --repo <repo>
npx tsx scripts/github.ts list-branches --repo <repo>
npx tsx scripts/github.ts list-commits --repo <repo> [--branch <branch>]
npx tsx scripts/github.ts set-visibility --repo <repo> --visibility public|private
```
