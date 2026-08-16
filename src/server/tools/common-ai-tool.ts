import type { AiToolDefinition } from '@/server/tools/tool-types'
import { objectParameters, stringProperty } from '@/server/tools/tool-types'

export const commonAiTools: AiToolDefinition[] = [
  {
    name: 'fetch-url-text',
    description: '从指定 URL 获取 html 内容',
    parameters: objectParameters(
      {
        url: stringProperty('网页 URL 地址')
      },
      ['url']
    ),
    executor: ({ url }) => {
      const targetUrl = new URL(url as string)
      targetUrl.username = ''
      targetUrl.password = ''

      return fetch(targetUrl).then(res => res.text())
    }
  }
]
