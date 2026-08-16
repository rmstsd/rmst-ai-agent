import type { AiToolDefinition } from '@/server/tools/tool-types'
import { emptyParameters } from '@/server/tools/tool-types'
import { bookMarkList } from '@/app/api/bookmark/route'

async function getBookmarkList() {
  return JSON.stringify(bookMarkList)
}

export const bookmarkAiTools: AiToolDefinition[] = [
  {
    name: 'getBookmarkList',
    description: '获取我的浏览器书签列表',
    parameters: emptyParameters,
    executor: getBookmarkList
  }
]
