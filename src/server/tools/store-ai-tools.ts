import type { AiToolDefinition } from '@/server/tools/tool-types'
import { objectParameters, stringProperty } from '@/server/tools/tool-types'

/** StoreAi 中注册的仓储库存查询工具。 */
export const storeAiTools: AiToolDefinition[] = [
  {
    name: 'listInventoryOfMaterial',
    description: '查询一个物料（货物）的库存明细，根据物料编号或名称，一般只需指定一个，但不能都不指定',
    parameters: objectParameters({
      materialId: stringProperty('物料编号，或者说物料 ID'),
      materialName: stringProperty('物料名称，支持模糊查询')
    })
  }
]
