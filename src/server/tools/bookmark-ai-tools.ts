import type { AiToolDefinition } from '@/server/tools/tool-types'
import { emptyParameters } from '@/server/tools/tool-types'
import type { M4Capabilities } from '@/server/m4-client'

export const bookmarkAiTools: AiToolDefinition[] = [
  {
    name: 'bookmark_getBookmarkList',
    description: '获取我的浏览器书签列表',
    parameters: emptyParameters
  }
]

export const BookmarkCapabilities: M4Capabilities = {
  systemPrompts: [],
  tools: bookmarkAiTools,
  hotWords: []
}
