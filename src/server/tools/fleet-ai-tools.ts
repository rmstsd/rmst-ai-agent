import type { AiToolDefinition } from '@/server/tools/tool-types'
import {
  arrayProperty,
  booleanProperty,
  emptyParameters,
  objectParameters,
  stringProperty
} from '@/server/tools/tool-types'

const robotName = stringProperty('机器人名称')
const orderId = stringProperty('运单')
const robotNameParameters = objectParameters({ robotName }, ['robotName'])
const orderIdParameters = objectParameters({ orderId }, ['orderId'])

const orderQueryProperties = {
  orderId: stringProperty('运单，支持模糊搜索'),
  fault: booleanProperty('运单是否故障'),
  statusList: arrayProperty('状态，支持查询多个'),
  createdOnStart: stringProperty('查询创建时间的起始时间点'),
  createdOnEnd: stringProperty('查询创建时间的结束时间点'),
  createdBy: stringProperty('创建人')
}

/** FleetAiArkManager 中注册的机器人、运单和诊断工具。 */
export const fleetAiTools: AiToolDefinition[] = [
  {
    name: 'getFaultRobots',
    description: '列出故障的机器人',
    parameters: emptyParameters
  },
  {
    name: 'retryFaultRobots',
    description: '重试故障的机器人。尝试清除故障，重新执行故障的运单。',
    parameters: objectParameters({
      robots: stringProperty('机器人名称，可以传多个，|分隔')
    })
  },
  {
    name: 'fetchRobotState',
    description: '查询机器人状态。查询结果中 currentNavTaskStatus 当前路径导航的状态为 0=没有导航,2=导航中,4=已完成,5=已失败,6=已取消；task_type 导航类型为 0=没有导航,3=路径导航到站点,7=平动转动,100=其他',
    parameters: robotNameParameters
  },
  {
    name: 'createRobotMoveOrder',
    description: '让机器人移动到指定点位',
    parameters: objectParameters(
      {
        robotName,
        toLocation: stringProperty('终点位置（点位或库位）')
      },
      ['robotName', 'toLocation']
    )
  },
  {
    name: 'robotGoToPark',
    description: '让机器人去停靠',
    parameters: robotNameParameters
  },
  {
    name: 'robotGoToCharge',
    description: '让机器人去充电',
    parameters: robotNameParameters
  },
  {
    name: 'robotOkToAcceptOrder',
    description: '机器人是否可以接单、是否可以接某个单。机器人不能接单的条件：所属机器人组已禁用、机器人已禁用、不接单、离线、无控制权、交管未就绪、有故障、后台任务挂掉、低电量、刚充电，满足其中一个就不能接单。当以上条件都满足接单了，若存在空库位，才可以接业务单，否则只能接自动单。当可以接业务单条件下，cannotAcceptBusinessOrderReason 为空才可以接指定的业务单',
    parameters: objectParameters({ robotName, orderId }, ['robotName'])
  },
  {
    name: 'robotNeedToCharging',
    description: '机器人是否需要充电、是否可以充电、为啥没有去充电',
    parameters: robotNameParameters
  },
  {
    name: 'robotNeedToParking',
    description: '机器人是否需要停靠、是否可以停靠、为啥没有去停靠',
    parameters: robotNameParameters
  },
  {
    name: 'clearRobotAlarms',
    description: '清除机器人告警',
    parameters: objectParameters({
      robotNames: arrayProperty('机器人名称，可不指定，若不指定则自动清除告警的机器人')
    })
  },
  {
    name: 'robotCanReachLocation',
    description: '机器人是否可以到达某个点位或库位',
    parameters: objectParameters(
      {
        robotNames: arrayProperty('机器人名称'),
        location: stringProperty('点位或库位')
      },
      ['robotNames', 'location']
    )
  },
  {
    name: 'robotNotMoveReason',
    description: '机器人为啥不动',
    parameters: objectParameters(
      { robotNames: arrayProperty('机器人名称') },
      ['robotNames']
    )
  },
  {
    name: 'getLastTransportOrder',
    description: '获取最新下发的一笔运单',
    parameters: emptyParameters
  },
  {
    name: 'createLoadUnloadTransportOrder',
    description: '将货物从一个位置搬到另一个位置',
    parameters: objectParameters(
      {
        fromLocation: stringProperty('起点位置（点位或库位）'),
        toLocation: stringProperty('终点位置（点位或库位）')
      },
      ['fromLocation', 'toLocation']
    )
  },
  {
    name: 'orderStepTimeToComplete',
    description: '运单当前步骤还有多久完成',
    parameters: orderIdParameters
  },
  {
    name: 'whyOrderNotAllocated',
    description: '运单为什么没有机器人接',
    parameters: orderIdParameters
  },
  {
    name: 'orderTimeToComplete',
    description: '运单还有多久完成',
    parameters: orderIdParameters
  },
  {
    name: 'countOrdersNum',
    description: '统计各种类型的运单数量。可以通过故障运单的数量。或根据状态统计的数量。根据创建人统计运单的数量。可以结合这些条件。',
    parameters: objectParameters(orderQueryProperties)
  },
  {
    name: 'queryOrders',
    description: '运单查询，批量查询运单的详细数据',
    parameters: objectParameters(orderQueryProperties)
  },
  {
    name: 'orderNotContinueExecuteReason',
    description: '运单为啥没有继续执行',
    parameters: objectParameters(
      { orderIds: arrayProperty('运单') },
      ['orderIds']
    )
  }
]
