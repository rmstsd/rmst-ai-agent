import type { AiToolDefinition } from '@/server/tools/tool-types'
import { emptyParameters, objectParameters, stringProperty } from '@/server/tools/tool-types'

export const logAiTools: AiToolDefinition[] = [
  {
    name: 'getCurrentDateTime',
    description: '获取当前日期时间',
    parameters: emptyParameters
  },
  {
    name: 'collectLog',
    description: '根据关键字、开始结束时间，收集相关日志，用于问题分析。如果用户未指定开始结束时间，取最近一小时。尽量先调用工具 getCurrentDateTime 获取当前时间',
    parameters: objectParameters(
      {
        keywords: stringProperty('关键字。|分隔多个关键字。必须提供。最好是机器人名、运单号、任务ID、门电梯等设备编号'),
        fromDateTime: stringProperty('开始日期时间。注意要精确的秒。'),
        toDateTime: stringProperty('结束日期时间。注意要精确的秒。')
      },
      ['keywords']
    )
  }
]
