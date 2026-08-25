---
name: m4-fleet-zyy
description: 处理 M4 车队运行和现场移动设备，包括 AMR/AGV 机器人、场景、地图、点位、导航、位置、电量、在线状态、故障告警、交通资源、门和电梯；适用于查询车队运行状态及控制单车或运行环境，不负责运输单、库存、Falcon 流程或 PLC/WCS 设备业务。
allowedTools: m4_read,m4_write
triggers:
  - m4-fleet
  - fleet
  - 车队
  - 机器人
  - 机器人状态
  - 机器人电量
  - 场景
  - 场景状态
  - 场景列表
  - 场景配置
  - 场景就绪
  - 地图
  - 地图资源
  - 路径规划
  - 交通资源
  - 门电梯
  - 电梯状态
  - 机器人位置
  - 机器人导航
  - 机器人故障
  - 机器人告警
  - 机器人重连
  - 软急停
  - AMR
  - AGV
  - robot status
  - robot position
  - robot battery
  - scene status
compatibility: M4 REST API 6.x
routingKeywords: '车队,车队运行,机器人,车辆,AMR,AGV,无人搬运车,场景,地图,导航,路径,位置,坐标,电量,电池,在线,离线,故障,告警,交通,拥堵,门,电梯,点位,路线,外部地图资源,robot,scene,fleet,navigation'
routingExcludes: '运单,运输单,库存,仓储,WMS,PLC,Modbus,OPC UA,Falcon,猎鹰,任务定义'
metadata:
  domain: fleet
  risk: mixed
  protocol: http,websocket
  apiVersion: '6.x'
  auth: server-injected
  readTool: m4_read
  writeTool: m4_write
  writeApproval: required
  runtime: m4-skills-runtime
  runtimeVersion: '0.2'
  requiredConfig: M4_BASE_URL,M4_AUTH_MODE
  capabilities: scenes,robots,navigation,maps,traffic,diagnosis,external-map-resources
---

# M4 车队运行

M4 的 API 根地址由部署配置提供，默认是 `http://localhost:5800`。请求必须使用部署要求的认证方式；不要猜测或生成凭据。所有返回内容都以 M4 为准。

通用 HTTP 约定见 [../../shared/m4-http-api.md](./shared/m4-http-api.md)，领域路径和参数见 [references/api.md](references/api.md)。需要执行本地请求时使用 `scripts/fleet.mjs`；脚本支持领域别名和通用 `request` 命令。在 web-agent-framework 中使用 `m4_read` 查询、使用 `m4_write` 变更；不要直接调用通用 HTTP 工具或执行脚本。

## 只读检查

- `GET /api/ping`
- `GET /api/fleet/scenes/list`
- `GET /api/fleet/scenes/{sceneId}/ready-status`
- `GET /api/fleet/scenes/{sceneId}/config`
- `POST /api/fleet/scenes/{sceneId}/query-all`
- `GET /api/fleet/scenes/{sceneId}/list-points-bins`
- `GET /api/fleet/robots/all-all?sceneId={sceneId}`
- `GET /api/fleet/robots/query-point?sceneId={sceneId}&robotName={robotName}`
- `GET /api/fleet/robots/query-group?sceneId={sceneId}&robotName={robotName}`
- `GET /api/fleet/robots/{sceneId}/traffic-resource`
- `GET /api/fleet/diagnosis/{sceneId}/diagnosis-list`

先解析真实的 `sceneId`、机器人名和点位，再进行后续请求。相互独立的只读查询可以并行；依赖前一响应中的 ID 时必须串行。

## 写操作

以下操作必须在调用前获得用户对具体目标和具体动作的明确确认：场景启停/调度暂停、机器人重连、取消/暂停/恢复导航、软急停、清除告警、禁用/恢复机器人、地图推送、机器人直连、RBK 请求和 DI/DO 写入。

成功后报告 HTTP 状态、目标 ID 和 M4 返回值。异步操作只能报告“已接受”，必须再次查询状态后才能报告完成。失败时保留 M4 的 `code`、`message` 和 `args`。
