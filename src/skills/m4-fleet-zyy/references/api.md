# 场景

输入参数错误返回 HTTP 400，并保留 M4 的 `code`、`message`、`args`。以下接口的 `sceneId` 均为 String；写接口需使用 `m4_write` 并确认目标场景。

## 列出场景

**用法解释**：获取当前 M4 的场景列表，后续请求应使用响应中的真实场景 ID。

**URL**
```http
GET /api/fleet/scenes/list
```

**请求报文**：无。

**响应报文：`List<SceneBasic>`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| id | 场景 ID | String | 是 | 场景标识。 |
| name | 场景名称 | String | 是 | 场景名称。 |
| disabled | 是否停用 | Boolean | 是 | true 表示停用。 |
| version | 版本 | Long | 是 | 场景版本。 |
| displayOrder | 显示顺序 | Int | 是 | 前端排序。 |
| lastModifiedOn | 修改日期 | Date | 否 | 最后修改时间。 |

**请求示例**
```http
GET /api/fleet/scenes/list
```

**响应示例**
```json
[{"id":"695CC8F12878603D13E98814","name":"生产场景","disabled":false,"version":12,"displayOrder":0,"lastModifiedOn":"2026-08-24T09:00:00+09:00"}]
```

## 获取场景结构

**用法解释**：返回场景基本信息、完整配置和地图/设备结构。

**URL**
```http
GET /api/fleet/scenes/schema/{id}
```

**请求报文**：路径参数 `id` 为 String，必填。

**响应报文：`SceneSchema`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| id | 场景 ID | String | 是 | 与路径参数一致。 |
| basic | 场景基本信息 | SceneBasic | 是 | 引用“列出场景”。 |
| newConfig | 场景配置 | SceneConfigAll | 是 | 配置策略。 |
| structure | 场景结构 | SceneStructure | 是 | 机器人、区域、地图和设备。 |

`SceneStructure` 字段：

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| robotGroups | 机器人组 | List<RobotGroup> | 是 | 机器人组列表。 |
| robotTags | 机器人标签 | List<RobotTag> | 是 | 标签列表。 |
| robots | 机器人 | List<SceneRobot> | 是 | 场景机器人列表。 |
| areas | 区域 | List<SceneArea> | 是 | 区域及地图。 |
| containerTypes | 容器类型 | List<SceneContainerType> | 是 | 容器类型列表。 |
| doors | 门设备 | List<SceneDoor> | 是 | 门配置。 |
| lifts | 电梯 | List<SceneLift> | 是 | 电梯配置。 |

`SceneArea` 字段：

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| id | 区域 ID | String | 是 | 区域标识。 |
| name | 区域名称 | String | 是 | 区域名称。 |
| disabled | 是否停用 | Boolean | 是 | 是否停用。 |
| displayOrder | 显示顺序 | Int | 是 | 排序。 |
| remark | 备注 | String | 否 | 备注。 |
| mergedMap | 合并地图 | AreaMap | 否 | 合并后的地图。 |
| gmMap | 组地图 | Map<Int, AreaMap> | 否 | 机器人组对应地图。 |
| groupsMap | 地图文件记录 | Map<Int, RobotAreaMapRecord> | 否 | 组地图文件信息。 |
| ui | UI 配置 | UiConfig | 否 | 文本、图片等配置。 |

**实体：`AreaMap`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| bound | 区域界限 | Rect | 否 | 地图边界。 |
| points | 点位 | List<MapPoint> | 否 | 地图点位。 |
| paths | 路径 | List<MapPath> | 否 | 地图路径。 |
| zones | 区块 | List<MapZone> | 否 | 地图区块。 |
| topoAreas | 拓扑区域 | List<TopoArea> | 否 | 拓扑区域。 |
| bins | 库位 | List<SceneBin> | 否 | 库位配置。 |
| restrictedLines | 禁行线 | List<MapRestrictedLine> | 否 | 禁行线。 |
| sourceMaps | 源地图名称 | List<String> | 否 | 源地图列表。 |
| envPointCloud | 环境点云 | EnvPointCloud | 否 | 点云配置。 |
| svgMapFile | SVG 文件 | String | 否 | SVG 文件路径。 |

**实体：`RobotGroup`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| id | 机器人组 ID | Int | 是 | 组标识。 |
| name | 名称 | String | 是 | 机器人组名称。 |
| disabled | 是否停用 | Boolean | 是 | 是否停用。 |
| displayOrder | 显示顺序 | Int | 是 | 排序。 |
| modelType | 机器人型号 | String | 是 | jack、trans-fork、height-fork、picking 等。 |
| icon | 图标 | String | 否 | 图标路径。 |
| remark | 备注 | String | 否 | 备注。 |
| salverNotRotate | 托盘支持旋转 | Boolean | 是 | 是否支持。 |
| fork | 是否叉车 | Boolean | 是 | 是否叉车组。 |
| idleForkDownOnMove | 空载行走调高 | Boolean | 是 | 空车边走边调高。 |
| loadedForkDownOnMove | 载货行走调高 | Boolean | 是 | 载货边走边调高。 |
| idlerSafeHeight | 空载安全高度 | Double | 否 | 高度。 |
| cargoSafeHeight | 载货安全高度 | Double | 否 | 高度。 |
| forkAdjDistBeforeLoad | 取货准备距离 | Double | 否 | 距离。 |
| forkAdjDistBeforeUnLoad | 放货准备距离 | Double | 否 | 距离。 |
| motionModel | 运动模型 | MotionModel | 是 | 枚举值按部署版本。 |
| motionDirection | 运动类型 | MotionDirection | 是 | 枚举值按部署版本。 |
| containerOversize | 容器超底盘 | Boolean | 是 | 是否超出底盘。 |
| collisionModel | 碰撞模型 | RobotCollisionModel | 是 | 碰撞模型。 |
| robotModel | 机器人模型 | RobotModelRecord | 否 | 模型记录。 |
| rbk35 | RBK 3.5 | Boolean | 是 | 是否为 RBK 3.5。 |
| safeDistHead | 前安全距离 | Double | 否 | 米。 |
| safeDistTail | 后安全距离 | Double | 否 | 米。 |
| safeDistLeft | 左安全距离 | Double | 否 | 米。 |
| safeDistRight | 右安全距离 | Double | 否 | 米。 |
| maxSpeed | 空载最大速度 | Double | 否 | 米/秒。 |
| maxBackSpeed | 空载最大后退速度 | Double | 否 | 米/秒。 |
| maxRotSpeed | 空载最大旋转速度 | Double | 否 | 弧度/秒。 |
| loadedMaxSpeed | 载货最大速度 | Double | 否 | 米/秒。 |
| loadedMaxBackSpeed | 载货最大后退速度 | Double | 否 | 米/秒。 |
| loadedMaxRotSpeed | 载货最大旋转速度 | Double | 否 | 弧度/秒。 |

**实体：`SceneContainerType`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| id | ID | String | 是 | 容器类型标识。 |
| name | 名称 | String | 是 | 容器类型名称。 |
| disabled | 是否停用 | Boolean | 是 | 是否停用。 |
| displayOrder | 显示顺序 | Int | 是 | 排序。 |
| remark | 备注 | String | 否 | 备注。 |
| imagePath | 图片路径 | String | 否 | 图片。 |
| height | 货架高度 | Double | 否 | 单层高度。 |
| radius | 旋转半径 | Double | 否 | 旋转半径。 |
| legHeight | 货架腿高度 | Double | 否 | 0 层高度。 |
| groupCenterDistances | 组中心距离 | Map<Int, Double> | 否 | 机器人组对应距离。 |
| outerWidth | 外宽 | Double | 否 | y 方向长度。 |
| outerLength | 外长 | Double | 否 | x 方向长度。 |
| width | 腿外宽度 | Double | 否 | 腿外宽。 |
| length | 腿外长度 | Double | 否 | 腿外长。 |
| legWidth | 腿形状宽度 | Double | 否 | 腿宽。 |
| legLength | 腿形状长度 | Double | 否 | 腿长。 |
| polygon | 外轮廓 | Polygon | 是 | 外轮廓多边形。 |
| legs | 货架腿 | List<Circle> | 否 | 腿集合。 |

**实体：`SceneDoor`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| id | ID | Int | 是 | 门标识。 |
| name | 名称 | String | 是 | 门名称。 |
| disabled | 是否停用 | Boolean | 是 | 是否停用。 |
| areaId | 所在区域 | Int | 是 | 所属区域。 |
| controlledPathKeys | 控制路径 | List<String> | 否 | 与 controlledPointNames 互斥。 |
| openPre | 是否提前开门 | Boolean | 是 | 是否提前。 |
| openPreDist | 提前距离 | Double | 否 | 距离。 |
| controlledPointNames | 控制点位 | List<String> | 否 | 与 controlledPathKeys 互斥。 |
| x | X 坐标 | Double | 否 | 门坐标。 |
| y | Y 坐标 | Double | 否 | 门坐标。 |
| theta | 朝向 | Double | 否 | 弧度。 |
| width | 宽度 | Double | 否 | 门宽。 |
| mock | 仿真模式 | Boolean | 是 | 是否仿真。 |
| adapterType | 适配器 | DoorAdapterType | 是 | Plc、Script、Mock。 |
| fetchReportFunName | 获取状态脚本 | String | 否 | 脚本方法。 |
| openDoorFunName | 开门脚本 | String | 否 | 脚本方法。 |
| closeDoorFunName | 关门脚本 | String | 否 | 脚本方法。 |
| plcName | PLC 名称 | String | 否 | PLC。 |
| plcOpenDoor | 开门地址 | PlcWriteCommand | 否 | PLC 写命令。 |
| plcCloseDoor | 关门地址 | PlcWriteCommand | 否 | PLC 写命令。 |
| plcOpenedStatus | 到位地址 | PlcReadCommand | 否 | PLC 读命令。 |
| plcFaultStatus | 故障信号 | PlcFaultCommand | 否 | PLC 故障命令。 |
| needOpenReset | 开门复位 | Boolean | 否 | 是否需要。 |
| needCloseReset | 关门复位 | Boolean | 否 | 是否需要。 |
| closeResetInterval | 关门复位间隔 | Long | 否 | 时间。 |
| pulse | 脉冲触发 | Boolean | 否 | 是否脉冲。 |
| pulseHighInterval | 高电平时间 | Long | 否 | 时间。 |
| pulseLowInterval | 低电平时间 | Long | 否 | 时间。 |

**实体：`SceneLift`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| id | ID | Int | 是 | 电梯标识。 |
| name | 名称 | String | 是 | 电梯名称。 |
| disabled | 是否停用 | Boolean | 是 | 是否停用。 |
| mock | 是否仿真 | Boolean | 是 | 是否仿真。 |
| adapterType | 适配器 | LiftAdapterType | 是 | Script、Mock、JinBo。 |
| floors | 楼层配置 | List<LiftFloorConfig> | 否 | 楼层列表。 |
| openDoorCost | 开门耗时 | Long | 否 | 时间。 |
| closeDoorCost | 关门耗时 | Long | 否 | 时间。 |
| changeFloorCost | 换层耗时 | Long | 否 | 时间。 |
| keepOpenDuration | 保持开门时间 | Long | 否 | 时间。 |
| host | 主机 | String | 否 | 梯控主机。 |
| port | 端口 | Int | 否 | 梯控端口。 |
| reportFunName | 状态脚本 | String | 否 | 脚本方法。 |
| openFunName | 开门脚本 | String | 否 | 脚本方法。 |
| closeFunName | 关门脚本 | String | 否 | 脚本方法。 |
| keepCalling | 持续开门信号 | Boolean | 否 | 是否持续。 |
| openDoorWaitingTimeout | 等梯超时 | Long | 否 | 时间。 |

**请求示例**
```http
GET /api/fleet/scenes/schema/695CC8F12878603D13E98814
```

**响应示例**
```json
{"id":"695CC8F12878603D13E98814","basic":{"id":"695CC8F12878603D13E98814","name":"生产场景","disabled":false},"newConfig":{},"structure":{"robotGroups":[],"robotTags":[],"robots":[],"areas":[],"containerTypes":[],"doors":[],"lifts":[]}}
```

## 查询场景实时数据

**用法解释**：查询指定场景的实时机器人、运单、交通和设备数据；HTTP 请求体与 WebSocket `Fleet3::Scene` 的 content 实体相同。

**URL**
```http
POST /api/fleet/scenes/{sceneId}/query-all
```

**请求报文：`QuerySceneAllReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| excluded | 排除模块 | List<String> | 否 | 例如 robots、orders、traffic。 |
| withRawReport | 返回原始报文 | Boolean | 否 | 默认 false。 |
| orderQueryType | 运单查询范围 | OrderQueryType | 否 | AllOrders、NoFinishedOrders、FaultOrders。 |
| rawFields | 原始字段 | List<String> | 否 | 指定机器人原始报文字段。 |

**响应报文：`SceneRuntimeSnapshot`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| sceneId | 场景 ID | String | 是 | 场景标识。 |
| robots | 机器人报告 | Map<String, RobotUiReport> | 是 | 当前机器人状态，键为机器人名称。 |
| orders | 运单 | List<TransportOrder> | 是 | 当前场景运单，实体见调度文档。 |
| goingCount | 执行中数量 | Int | 是 | 执行中运单数。 |
| faultCount | 故障数量 | Int | 是 | 故障数量。 |
| ordersRecords | 运单记录 | Map<String, Object> | 否 | 统计记录。 |
| dispatchProfile | 派单统计 | Map<String, Object> | 否 | 调度统计。 |
| trafficDebug | 交通调试 | Map<String, Object> | 否 | 交通规划调试数据。 |
| replyTimestamp | 响应时间 | Long | 是 | Unix 毫秒时间戳。 |

**请求示例**
```json
{"excluded":["trafficDebug"],"orderQueryType":"AllOrders","withRawReport":false}
```

**响应示例**
```json
{"sceneId":"695CC8F12878603D13E98814","robots":[],"orders":[],"goingCount":0,"faultCount":0,"replyTimestamp":1768296469100}
```

## 获取场景配置

**用法解释**：读取指定场景的调度、交通、充电、回调和电梯配置。

**URL**
```http
GET /api/fleet/scenes/{sceneId}/config
```

**请求报文**：无；路径参数 `sceneId` 为 String，必填。

**响应报文：`SceneConfigAll`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| robot | 机器人策略 | SceneConfigSection<ScRobot> | 是 | 机器人连接、静止检测等。 |
| dispatch | 派单策略 | SceneConfigSection<ScDispatch> | 是 | 派单与重分派。 |
| traffic | 交管策略 | SceneConfigSection<ScTraffic> | 是 | 交通规划。 |
| tp1 | TP1 配置 | SceneConfigSection<ScTp1> | 是 | 死锁、全局规划。 |
| tp2 | TP2 配置 | SceneConfigSection<ScTp2> | 是 | CBS 权重。 |
| charge | 充电策略 | SceneConfigSection<ScCharge> | 是 | 充电阈值。 |
| parkPoints | 停靠点位 | SceneConfigSection<ScPoints> | 是 | 点位列表。 |
| chargePoints | 充电点位 | SceneConfigSection<ScPoints> | 是 | 点位列表。 |
| cpnEnabled | 启用光通讯 | Boolean | 是 | 是否启用。 |
| cpnDispatchPeriod | 光通讯派单周期 | Long | 否 | 周期。 |
| selectConfig | 批量选择配置 | String | 否 | 前端配置。 |
| unloadExHandler | 异常放货处理 | ScUnloadExHandler | 是 | 已取货未放货时的处理。 |
| unloadExEnabled | 启用异常处理 | Boolean | 是 | 是否启用。 |
| enableOrderCallback | 启用运单回调 | Boolean | 是 | 是否启用。 |
| orderCallbackConfig | 运单回调配置 | OrderCallbackConfig | 否 | 回调地址和状态。 |
| enableRobotCallback | 启用机器人回调 | Boolean | 是 | 是否启用。 |
| robotCallbackConfig | 机器人回调配置 | RobotCallbackConfig | 否 | 回调地址和状态。 |
| enableSysFaultCallback | 启用故障回调 | Boolean | 是 | 是否启用。 |
| sysFaultCallbackConfig | 故障回调配置 | SysFaultCallbackConfig | 否 | 故障回调。 |
| longOfflineThreshold | 长时间离线阈值 | Double | 否 | 秒。 |
| lift | 电梯策略 | SceneLiftConfig | 否 | 电梯调度配置。 |

`SceneConfigSection<T>` 字段：`policies: List<SceneConfigPolicy<T>>`。`SceneConfigPolicy<T>` 字段：`id: String`、`name: String`、`displayOrder: Int`、`defaultOne: Boolean`、`timeRange: EffectiveTimeRange`、`customizeRg: CustomizeRobotGroup`、`config: T`。

**实体：`ScRobot`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| robotStateFetchDelay | 状态获取间隔 | Long | 否 | 毫秒。 |
| robotStateFailureNumToAutoConnect | 连续失败重连次数 | Int | 否 | 次数。 |
| robotStateErrorToAutoReconnectMax | 自动重连最大次数 | Int | 否 | 次数。 |
| noOpLog | 关闭运行记录 | Boolean | 否 | 是否关闭。 |
| opLogKeepDays | 运行记录保留天数 | Int | 否 | 天数。 |
| noRbkMsgLog | 不记录 RBK 报文 | Boolean | 否 | 是否关闭。 |
| disconnectIfRequestTimeout | 请求超时断开 | Boolean | 否 | 是否断开。 |
| onPointOrPathDist | 点/路径精度 | Double | 否 | 米。 |
| returnToPointOrPathDist | 回归精度 | Double | 否 | 米。 |
| stopRobotsIfDoorException | 门异常急停 | Boolean | 否 | 是否急停。 |
| stillCheckEnabled | 静止检测 | Boolean | 否 | 是否启用。 |
| stillVec | 静止线速度阈值 | Double | 否 | 米/秒。 |
| stillAngularVec | 静止角速度阈值 | Double | 否 | 弧度/秒。 |
| forceArrivePointAfterCancel | 取消后强制到点 | Boolean | 否 | 是否强制。 |
| robotBrakeDistance | 刹车距离 | Double | 否 | 米。 |

**实体：`ScDispatch`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| dispatchMethod | 派单策略 | DispatchMethod | 否 | Greedy、KM。 |
| dispatchSort | 派单排序 | List<String> | 否 | 排序字段。 |
| dispatchAcceptableTimeout | 派单等待上限 | Long | 否 | 秒。 |
| withdrawnMinCost | 重分派最小成本差 | Double | 否 | 成本差。 |
| parkingPaused | 暂停停靠 | Boolean | 否 | 是否暂停。 |
| chargingPaused | 暂停充电 | Boolean | 否 | 是否暂停。 |
| parkingCollisionCheckMode | 停靠碰撞检测 | CollisionCheckMode | 否 | None、TargetPoint、TargetPath。 |
| noReallocation | 停用重分派 | Boolean | 否 | 是否停用。 |
| robotPlanPausedOnSelfReportErrorOrFatal | 机器人错误暂停派单 | Boolean | 否 | 是否暂停。 |
| notCancelRobot | 取消步骤不取消导航 | Boolean | 否 | 是否保留导航。 |
| inPlaceWaitSec | 原地等待时间 | Double | 否 | 秒，null 默认。 |
| inPlaceWaitDistanceThreshold | 接单距离阈值 | Double | 否 | 米。 |
| parkIdleTime | 生成停靠前空闲时间 | Int | 否 | 秒。 |

**实体：`ScTraffic`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| trafficMethod | 交管策略 | TrafficMethod | 否 | Distributed、Venus。 |
| trafficPlanPaused | 暂停交管规划 | Boolean | 否 | 是否暂停。 |
| trafficPlanPausedOnFailedPlan | 规划失败暂停 | Boolean | 否 | 是否暂停。 |
| trafficDevConfigStr | 高级配置 | String | 否 | 配置文本。 |
| pathReleaseMinDistance | 至少下发距离 | Double | 否 | 米。 |
| mapResEnvPointCloudEnabled | 启用环境点云 | Boolean | 否 | 是否启用。 |
| mapResProhibitedLineEnabled | 启用禁行线 | Boolean | 否 | 是否启用。 |
| mapResProhibitedZoneEnabled | 启用禁行区 | Boolean | 否 | 是否启用。 |
| enableFaultVehicleDetour | 故障绕行 | Boolean | 否 | 是否启用。 |
| faultVehicleTimeout | 故障车等待超时 | Int | 否 | 秒。 |
| maxDetourDistance | 故障最大绕行距离 | Double | 否 | 米。 |
| enableWorkingVehicleDetour | 作业绕行 | Boolean | 否 | 是否启用。 |
| workingVehicleWaitTimeout | 作业车等待超时 | Int | 否 | 秒。 |
| maxWorkingDetourDistance | 作业最大绕行距离 | Double | 否 | 米。 |

**实体：`ScTp1`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| linkMinDistance | 死锁环推最小距离 | Double | 否 | 距离。 |
| linkMaxDistance | 死锁环推最大距离 | Double | 否 | 距离。 |
| reverseDeadlock | 倒车解死锁 | Boolean | 否 | 是否启用。 |
| enablePrevent | 死锁预防 | Boolean | 否 | 是否启用。 |
| preRotate | 前置旋转 | Boolean | 否 | 是否启用。 |
| enableMapf | 全局规划 | Boolean | 否 | 是否启用。 |
| mapfType | 全局规划算法 | String | 否 | 算法名称。 |
| detourType | 绕道策略 | String | 否 | auto、manual。 |
| enableDynamicBalancingStrategy | 动态均衡 | Boolean | 否 | 是否启用。 |

**实体：`ScTp2`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| cbsHighW | 全局有界最优参数 | Double | 否 | 成本倍数。 |
| cbsLowW | 单车有界最优参数 | Double | 否 | 成本倍数。 |

**实体：`ScCharge`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| chargeOnly | 强充电量 | Double | 否 | 电量比例。 |
| chargeNeed | 可充电量 | Double | 否 | 电量比例。 |
| chargeOk | OK 电量 | Double | 否 | 电量比例。 |
| chargeFull | 满电量 | Double | 否 | 电量比例。 |
| minChargingTime | 最小充电时间 | Int | 否 | 秒。 |
| idleTime | 生成充电前空闲时间 | Int | 否 | 秒。 |
| maintainCharge | 维保充电 | Boolean | 否 | 是否启用。 |
| maintainLoop | 维保循环次数 | Int | 否 | 次数。 |
| chargeStartTimeout | 起充超时 | Long | 否 | 秒。 |

**实体：`ScPoints`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| points | 绑定点位 | List<String> | 否 | 点位名称集合。 |

**实体：`ScUnloadExHandler`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| mode | 放货方式 | UnloadExHandlerMode | 否 | ManualAssign、SendToDistricts、SendBack。 |
| binQuery | 库位条件 | ComplexQuery | 否 | 库位匹配条件。 |
| sort | 排序 | String | 否 | 逗号分隔。 |
| extraRules | 特殊规则 | List<ScUnloadExtraRules> | 否 | 规则列表。 |

**实体：`OrderCallbackConfig`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| callbackStatusList | 回调状态 | List<OrderCallbackStatus> | 否 | ToBeAllocated、Allocated、Pending、Executing、Done、Cancelling、Cancelled、Withdrawing。 |
| callbackUrlList | 回调地址 | List<String> | 否 | URL 列表。 |
| retryTimes | 重试次数 | Int | 否 | 次数。 |
| retryInterval | 重试间隔 | Int | 否 | 时间。 |
| scriptFunc | 脚本函数 | String | 否 | 可选脚本。 |

**实体：`RobotCallbackConfig`**：字段表同 `OrderCallbackConfig`，其中 `callbackStatusList` 类型为 `List<RobotExecuteStatus>`，枚举为 Idle、Moving、Failed。

**实体：`SysFaultCallbackConfig`**：字段表同 `OrderCallbackConfig`，其中状态字段为 `callbackSysFaultTypeList: List<SysFaultType>`，枚举为 Falcon、Fleet、BgTask。

**实体：`SceneLiftConfig`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| mode | 电梯调度模式 | SceneLiftDispatchMethod | 否 | Timeline、Greedy。 |
| notPreCallLift | 是否提前呼梯 | Boolean | 否 | 是否提前。 |
| preCallLiftTime | 提前呼梯时间 | Double | 否 | 时间。 |
| robotQueueLimitPerFloor | 每层等待机器人上限 | Int | 否 | 数量。 |
| canInterruptGoto | 可打断 goto | Boolean | 否 | 是否允许。 |
| robotMoveOnceLiftArrivedAndOpened | 开门后立即进出 | Boolean | 否 | 是否立即。 |
| showMoreLog | 记录更多日志 | Boolean | 否 | 是否启用。 |
| showPkgLog | 记录梯控报文 | Boolean | 否 | 是否启用。 |

**请求示例**
```http
GET /api/fleet/scenes/695CC8F12878603D13E98814/config
```

**响应示例**
```json
{"robot":{"policies":[{"id":"p1","name":"Default","displayOrder":0,"defaultOne":true,"config":{"robotStateFetchDelay":500}}]},"dispatch":{"policies":[]},"traffic":{"policies":[]},"cpnEnabled":false,"unloadExEnabled":false}
```

## 查询场景就绪状态

**用法解释**：检查场景是否可以接收调度任务。

**URL**
```http
GET /api/fleet/scenes/{sceneId}/ready-status
```

**请求报文**：无。

**响应报文：Boolean**：true 表示场景已初始化并就绪，false 表示未就绪。

**请求示例**
```http
GET /api/fleet/scenes/695CC8F12878603D13E98814/ready-status
```

**响应示例**
```json
true
```

## 查询场景点位和库位

**用法解释**：列出场景中可用于运单的点位和库位。

**URL**
```http
GET /api/fleet/scenes/{sceneId}/list-points-bins
```

**请求报文**：无。

**响应报文：`PointsBins`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| points | 点位名称 | List<String> | 是 | 点位名称集合。 |
| bins | 库位名称 | List<String> | 是 | 库位名称集合。 |

**请求示例**
```http
GET /api/fleet/scenes/695CC8F12878603D13E98814/list-points-bins
```

**响应示例**
```json
{"points":["AP2483","LM65"],"bins":["BHQ1_0105_04"]}
```

## 计算机器人到点距离

**用法解释**：计算多个机器人到各自目标点的距离；不连通或点位不存在返回 -1。

**URL**
```http
POST /api/fleet/scenes/{sceneId}/calc-move-costs
```

**请求报文：`Map<String, List<String>>`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| key | 机器人名称 | String | 是 | Map 键。 |
| value | 目标点列表 | List<String> | 是 | 目标点位名称。 |

**响应报文：`Map<String, Map<String, Double>>`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| robotName | 机器人名称 | String | 是 | 外层 Map 键。 |
| loc | 目标点 | String | 是 | 内层 Map 键。 |
| distance | 距离 | Double | 是 | -1 表示不连通或不存在。 |

**请求示例**
```json
{"sim_02":["LM65","LM25"],"sim_01":["LM24"]}
```

**响应示例**
```json
{"sim_01":{"LM24":24.9534},"sim_02":{"LM25":25.4844,"LM65":42.4934}}
```

## 更新场景禁用状态

**用法解释**：启用或停用场景。

**URL**
```http
POST /api/fleet/scenes/{sceneId}/disable
```

**请求报文：`DisableReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| disabled | 是否停用 | Boolean | 是 | true 停用，false 启用。 |

**响应报文**：无响应正文。

**请求示例**
```json
{"disabled":true}
```

**响应示例**
```http
HTTP/1.1 200 OK
```

## 更新调度暂停状态

**用法解释**：暂停或恢复指定场景的调度。

**URL**
```http
POST /api/fleet/scenes/{sceneId}/dispatch-pause
```

**请求报文：`DispatchPauseReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| paused | 是否暂停 | Boolean | 是 | true 暂停。 |

**响应报文**：无响应正文。

**请求示例**
```json
{"paused":true}
```

**响应示例**
```http
HTTP/1.1 200 OK
```

# 场景维护

## 创建场景

**用法解释**：创建一个空场景，返回新场景 ID。

**URL**
```http
POST /api/fleet/scenes/create
```

**请求报文：`CreateSceneReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| name | 场景名称 | String | 是 | 场景名称，不能为空。 |

**响应报文：`CreateSceneRes`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| id | 场景 ID | String | 是 | 新场景 ID。 |

**请求示例**
```json
{"name":"生产场景"}
```

**响应示例**
```json
{"id":"695CC8F12878603D13E98814"}
```

## 删除场景

**用法解释**：删除一个或多个场景，属于高影响操作。

**URL**
```http
POST /api/fleet/scenes/remove
```

**请求报文：`IdsReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| ids | 场景 ID 列表 | List<String> | 是 | 待删除场景。 |

**响应报文**：无响应正文。

**请求示例**
```json
{"ids":["695CC8F12878603D13E98814"]}
```

**响应示例**
```http
HTTP/1.1 200 OK
```

## 更新场景基本信息

**用法解释**：部分更新场景名称和显示顺序。

**URL**
```http
POST /api/fleet/scenes/{sceneId}/basic/patch
```

**请求报文：`SceneBasicPatchReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| name | 场景名称 | String | 否 | 传入时不能为空。 |
| displayOrder | 显示顺序 | Int | 否 | 前端排序。 |

**响应报文**：无响应正文。

**请求示例**
```json
{"name":"生产场景-一号线","displayOrder":1}
```

**响应示例**
```http
HTTP/1.1 200 OK
```

## 更新场景配置

**用法解释**：按部署配置实体部分更新场景策略，属于高影响写操作。

**URL**
```http
POST /api/fleet/scenes/{sceneId}/config/patch
```

**请求报文：`Map<String, Object>`**：字段为要更新的 `SceneConfigAll` 子字段。

**响应报文**：无响应正文。

**请求示例**
```json
{"dispatch":{"policies":[{"id":"p1","config":{"parkingPaused":true}}]}}
```

**响应示例**
```http
HTTP/1.1 200 OK
```

# 机器人

## 查询全部机器人状态

**用法解释**：查询场景内全部机器人的 UI 状态。

**URL**
```http
GET /api/fleet/robots/all-all?sceneId=695CC8F12878603D13E98814
```

**请求报文**：查询参数 `sceneId` 为 String，必填。

**响应报文：`Map<String, RobotUiReport>`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| robotName | 机器人名称 | String | 是 | 机器人标识。 |
| sceneId | 场景 ID | String | 是 | 所属场景。 |
| x | X 坐标 | Double | 否 | 当前坐标。 |
| y | Y 坐标 | Double | 否 | 当前坐标。 |
| direction | 朝向 | Double | 否 | 弧度。 |
| currentSite | 当前点位 | String | 否 | 当前点位。 |
| battery | 电量 | Double | 否 | 电量比例或百分比，按部署版本。 |
| status | 机器人状态 | RobotStatus | 否 | 以部署版本枚举为准。 |
| online | 是否在线 | Boolean | 是 | 在线状态。 |
| disabled | 是否禁用 | Boolean | 是 | 禁用状态。 |
| fault | 是否故障 | Boolean | 是 | 故障状态。 |
| faultMessage | 故障信息 | String | 否 | 故障文本。 |

**请求示例**
```http
GET /api/fleet/robots/all-all?sceneId=695CC8F12878603D13E98814
```

**响应示例**
```json
{"Box-02":{"robotName":"Box-02","sceneId":"695CC8F12878603D13E98814","x":4.2,"y":-31.1,"direction":1.57,"currentSite":"AP2483","battery":0.86,"online":true,"disabled":false,"fault":false}}
```

## 查询机器人当前点位

**用法解释**：查询指定机器人当前所在点位。

**URL**
```http
GET /api/fleet/robots/query-point?sceneId=695CC8F12878603D13E98814&robotName=Box-02
```

**请求报文**：`sceneId`、`robotName` 均为 String，必填。

**响应报文：`RobotPoint`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| robotName | 机器人名称 | String | 是 | 机器人标识。 |
| pointName | 当前点位 | String | 否 | 可能为空。 |
| direction | 朝向 | Double | 否 | 弧度。 |
| x | X 坐标 | Double | 否 | 当前坐标。 |
| y | Y 坐标 | Double | 否 | 当前坐标。 |

**请求示例**
```http
GET /api/fleet/robots/query-point?sceneId=695CC8F12878603D13E98814&robotName=Box-02
```

**响应示例**
```json
{"pointName":"AP2483","direction":1.57,"x":4.2,"y":-31.1}
```

## 查询机器人 IO

**用法解释**：读取指定机器人 DI/DO 当前值。

**URL**
```http
GET /api/fleet/robots/{sceneId}/robot-io/{robotName}
```

**请求报文**：路径参数 `sceneId`、`robotName` 为 String，必填。

**响应报文：`RobotIo`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| robotName | 机器人名称 | String | 是 | 机器人标识。 |
| DI | 数字输入 | List<RobotIoItem> | 是 | DI 列表。 |
| DO | 数字输出 | List<RobotIoItem> | 是 | DO 列表。 |

**实体：`RobotIoItem`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| id | 通道 ID | String | 否 | 3.4 通道标识。 |
| key | 通道 key | String | 否 | 3.5 通道标识。 |
| status | 当前状态 | Boolean | 是 | DI/DO 状态。 |
| valid | 是否有效 | Boolean | 否 | DI 有效状态。 |
| source | 来源 | String | 否 | IO 来源。 |

**请求示例**
```http
GET /api/fleet/robots/695CC8F12878603D13E98814/robot-io/Box-02
```

**响应示例**
```json
{"robotName":"Box-02","di":{"0":true},"do":{"0":false}}
```

## 机器人重连

**用法解释**：重连指定场景的一个或多个机器人。`robotNames` 为空表示场景内全部启用机器人。

**URL**
```http
POST /api/fleet/robots/reconnect
```

**请求报文：`ReconnectReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| sceneId | 场景 ID | String | 是 | 目标场景。 |
| robotNames | 机器人名称 | List<String> | 否 | null 表示全部启用机器人。 |

**响应报文：`Map<String, ParallelResult<Object>>`**：字段同调度文档“批量封口运单”。

**请求示例**
```json
{"sceneId":"695CC8F12878603D13E98814","robotNames":["Box-02"]}
```

**响应示例**
```json
{"Box-02":{"ok":true,"result":{},"errMsg":null}}
```

## 取消机器人导航

**用法解释**：取消指定机器人的当前导航。

**URL**
```http
POST /api/fleet/robots/cancel-nav
```

**请求报文：`NavReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| sceneId | 场景 ID | String | 是 | 目标场景。 |
| robotNames | 机器人名称 | List<String> | 是 | 目标机器人列表。 |

**响应报文**：无响应正文。

**请求示例**
```json
{"sceneId":"695CC8F12878603D13E98814","robotNames":["Box-02"]}
```

**响应示例**
```http
HTTP/1.1 200 OK
```

## 暂停机器人导航

**用法解释**：暂停指定机器人正在执行的导航。

**URL**
```http
POST /api/fleet/robots/pause-nav
```

**请求报文：`NavReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| sceneId | 场景 ID | String | 是 | 目标场景。 |
| robotNames | 机器人名称 | List<String> | 是 | 目标机器人列表。 |

**响应报文**：无响应正文。

**请求示例**
```json
{"sceneId":"695CC8F12878603D13E98814","robotNames":["Box-02"]}
```

**响应示例**
```http
HTTP/1.1 200 OK
```

## 恢复机器人导航

**用法解释**：恢复处于暂停状态的机器人导航。

**URL**
```http
POST /api/fleet/robots/resume-nav
```

**请求报文：`NavReq`**：字段同“暂停机器人导航”。

**响应报文**：无响应正文。

**请求示例**
```json
{"sceneId":"695CC8F12878603D13E98814","robotNames":["Box-02"]}
```

**响应示例**
```http
HTTP/1.1 200 OK
```

## 设置机器人软急停

**用法解释**：设置或解除指定机器人软急停。

**URL**
```http
POST /api/fleet/robots/{sceneId}/set-soft-emc
```

**请求报文：`SoftEmcReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| robotNames | 机器人名称 | List<String> | 是 | 目标机器人列表。 |
| enable | 软急停 | Boolean | 是 | true 设置，false 解除。 |

**响应报文**：无响应正文。

**请求示例**
```json
{"robotNames":["Box-02"],"enable":true}
```

**响应示例**
```http
HTTP/1.1 200 OK
```

## 禁用或启用机器人

**用法解释**：修改机器人是否参与调度。

**URL**
```http
POST /api/fleet/robots/{sceneId}/disabled
```

**请求报文：`RobotDisabledReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| robotNames | 机器人名称 | List<String> | 是 | 目标机器人。 |
| disabled | 是否禁用 | Boolean | 是 | true 禁用，false 启用。 |

**响应报文**：无响应正文。

**请求示例**
```json
{"robotNames":["Box-02"],"disabled":true}
```

**响应示例**
```http
HTTP/1.1 200 OK
```

## 写入机器人 DI

**用法解释**：向机器人写入数字输入信号，属于设备控制操作。

**URL**
```http
POST /api/fleet/robots/{sceneId}/set-di
```

**请求报文：`IORequest`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| robotName | 机器人名称 | String | 是 | 目标机器人。 |
| id | 通道 ID 或 key | String | 是 | 3.4 使用数字 ID，3.5 使用 key。 |
| status | 状态 | Boolean | 是 | DI true 启用；DO true 高电平。 |

**响应报文**：无响应正文。

**请求示例**
```json
{"robotName":"Box-02","id":"0","status":true}
```

**响应示例**
```http
HTTP/1.1 200 OK
```

## 写入机器人 DO

**用法解释**：向机器人写入数字输出信号，属于设备控制操作。

**URL**
```http
POST /api/fleet/robots/{sceneId}/set-do
```

**请求报文：`IORequest`**：字段同“写入机器人 DI”，`id` 为 DO 通道。

**响应报文**：无响应正文。

**请求示例**
```json
{"robotName":"Box-02","id":"1","status":false}
```

**响应示例**
```http
HTTP/1.1 200 OK
```

## 清除机器人告警

**用法解释**：清除指定机器人自身告警，属于控制操作。

**URL**
```http
POST /api/fleet/robots/{sceneId}/clear-alarm
```

**请求报文：`RobotNamesReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| robotNames | 机器人名称 | List<String> | 是 | 目标机器人。 |

**响应报文：`Map<String, ParallelResult<Object>>`**：字段同调度文档“批量封口运单”。

**请求示例**
```json
{"robotNames":["Box-02"]}
```

**响应示例**
```json
{"Box-02":{"ok":true,"result":{},"errMsg":null}}
```

## 通用 RBK 请求

**用法解释**：向指定机器人转发 RBK API 请求，仅用于已确认的设备调试。

**URL**
```http
POST /api/fleet/robots/rbk-request
```

**请求报文：`RbkRequestReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| sceneName | 场景名称 | String | 是 | 目标场景名称。 |
| robotName | 机器人名称 | String | 是 | 目标机器人。 |
| apiNo | RBK API 编号 | Int | 是 | 设备接口编号。 |
| reqBody | 请求正文 | Map<String, Object> | 否 | RBK 请求参数。 |
| timeout | 超时时间 | Long | 否 | 毫秒，默认 5000。 |

**响应报文：`Map<String, Object>`**：机器人返回的 RBK 响应。

**请求示例**
```json
{"sceneName":"生产场景","robotName":"Box-02","apiNo":1001,"reqBody":{},"timeout":5000}
```

**响应示例**
```json
{"ret":0,"msg":"ok"}
```

# 外部地图资源

## 申请外部地图资源

**用法解释**：增量申请点位、路径或空间区域资源；同一次请求的资源必须属于同一场景、同一区域且 owner 相同。谁申请谁释放。

**URL**
```http
POST /api/fleet/external-map-res/request
```

**请求报文：`List<MapResourceUnit>`**

`MapResourceUnit` 字段：

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| unitId | 单元 ID | String | 是 | 每次申请唯一，建议 UUID。 |
| owner | 所有者 | String | 是 | 机器人或外部系统名称。 |
| reason | 原因 | String | 否 | 申请原因。 |
| sceneId | 场景 ID | String | 否 | 与 sceneName 二选一。 |
| sceneName | 场景名称 | String | 否 | 不使用 sceneId 时生效。 |
| areaId | 区域 ID | Int | 否 | 与 areaName 二选一。 |
| areaName | 区域名称 | String | 否 | 不使用 areaId 时生效。 |
| pointNames | 占用点位 | List<String> | 否 | 点位资源。 |
| pathKeys | 占用路径 | List<String> | 否 | 路径资源。 |
| spatialZones | 占用区域 | List<Polygon> | 否 | 多边形资源。 |

`Polygon` 字段：`points: List<Point2D>`（必填）、`type: PolygonShape`（Concave、Other、Rect，必填）。`Point2D` 字段：`x: Double`、`y: Double`，均必填。

**响应报文：`MapResourceResult`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| ok | 申请结果 | Boolean | 是 | true 表示全部申请成功。 |
| occupiedSpaceResource | 已占用冲突资源 | List<SpaceResource> | 否 | 申请失败时返回。 |
| futureSpaceResource | 未来冲突资源 | List<SpaceResource> | 否 | 预测未来路径冲突。 |

`SpaceResource` 字段：`type: SpaceResourceType`（Rect、Circle、Polygon）、`points: List<Point2D>`、`radius: Double`。失败时 `message` 可能为 owner 为空、场景/区域不存在或资源已被其他 owner 占用等原因。

**请求示例**
```json
[{"unitId":"a-004-1","owner":"AMB-06","sceneId":"685A06C1373D9D2CFD46D1A4","areaId":0,"pointNames":["AP1090","AP1089"]}]
```

**响应示例**
```json
{"ok":true,"occupiedSpaceResource":null,"futureSpaceResource":null}
```

## 释放外部地图资源

**用法解释**：按 unitId 释放部分或全部资源；不存在的 unitId 不影响其他资源释放。

**URL**
```http
POST /api/fleet/external-map-res/release
```

**请求报文：`List<String>`**：待释放的 unitId 列表，必填。

**响应报文：`MapResourceReleaseResult`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| ok | 最终状态 | Boolean | 是 | 全部成功为 true。 |
| failedUnitIds | 释放失败 ID | Set<String> | 是 | 释放失败集合。 |
| notFoundUnitIds | 不存在 ID | Set<String> | 是 | 不存在集合。 |

**请求示例**
```json
["a-004-3"]
```

**响应示例**
```json
{"ok":true,"failedUnitIds":[],"notFoundUnitIds":[]}
```

## 按所有者释放外部地图资源

**用法解释**：释放 owner 在指定场景/区域申请的全部资源；场景和区域参数均可省略。

**URL**
```http
POST /api/fleet/external-map-res/release-by-owner
```

**请求报文：`ReleaseByOwnerReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| owner | 所有者 | String | 是 | 申请时的 owner。 |
| sceneId | 场景 ID | String | 否 | 与 sceneName 二选一。 |
| sceneName | 场景名称 | String | 否 | 不使用 sceneId 时生效。 |
| areaId | 区域 ID | Int | 否 | 与 areaName 二选一。 |
| areaName | 区域名称 | String | 否 | 不使用 areaId 时生效。 |

**响应报文：`MapResourceReleaseResult`**：字段同“释放外部地图资源”。

**请求示例**
```json
{"owner":"AMB-06","sceneId":"A"}
```

**响应示例**
```json
{"ok":true,"failedUnitIds":[],"notFoundUnitIds":[]}
```

## 释放所有外部地图资源

**用法解释**：释放系统中所有外部地图资源，可能影响其他外部系统，必须单独确认。

**URL**
```http
POST /api/fleet/external-map-res/release-all
```

**请求报文**：无。

**响应报文：`MapResourceReleaseResult`**：字段同“释放外部地图资源”。

**请求示例**
```http
POST /api/fleet/external-map-res/release-all
```

**响应示例**
```json
{"ok":true,"failedUnitIds":[],"notFoundUnitIds":[]}
```
