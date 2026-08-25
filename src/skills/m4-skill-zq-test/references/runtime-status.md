# M4 运行时状态

配置数据和实时数据必须分开处理：`fleet/scenes/schema/{sceneId}` 主要用于验证配置；机器人在线、任务、告警、门、电梯和货位占用必须使用运行时查询。

## 实时场景

通过 WebSocket 操作 `Fleet::Scene` 查询：

```json
{
  "sceneId": "scene-001",
  "excluded": [],
  "orderQueryType": "NoFinishedOrders"
}
```

响应可能包含以下模块：

- `status`：场景运行状态。
- `pauseStatus`：调度状态，见 [status-model.md](status-model.md)。
- `robots`：机器人实时报告。
- `orders`、`ordersRecords`：运行中订单和运行记录。
- `goingCount`、`faultCount`：订单统计。
- `doors`：门实时状态。
- `lifts`：电梯实时状态。
- `fleetBins`：纯调度模式下的货位占用和容器信息。
- `trafficConditions`、`trafficDebug`：交通管理诊断。
- `dispatchProfile`：当前调度配置摘要。

只请求当前任务需要的模块，并在工具层投影字段。不要将完整 WebSocket 响应放入模型上下文。

## 机器人状态

从 `robots` 中按机器人名称提取必要字段：

- 连接：`online`、`signal`、`connectMsg`、`rTime`。
- 系统：`sysStatus`、`emc`、`sEmc`、`alarms`、`reloc`、`c`。
- 位置：`x`、`y`、`d`、`p`、`areaId`、`map`。
- 运动：`v`、`rv`、`blocked`、`blockedMsg`、`bbr`、`containerBlockedBy`。
- 任务：`cmdStatus`、`orders`、`cuOrderId`、`cuStepIndex`、`cuStepLocation`、`op`、`navStatus`。
- 资源：`battery`、`charging`、`bins`、`loads`。
- 调度：`offDuty`、`isMaster`、`cff`、`tReady`、`parkDisabled`、`chargeDisabled`。

状态解释：`online=false` 不等于机器人配置禁用；`cmdStatus=Failed` 表示执行失败；`blocked=true` 必须结合 `blockedMsg`、`bbr` 和告警判断原因；`battery` 是 0 到 1 的比例；`navStatus` 使用 `Waiting`、`Running`、`Suspended`、`Completed`、`Failed`、`Canceled` 等值。

若只需要位置，使用 WebSocket 操作 `Fleet3::RobotsPositionOnly::Query`，不要请求完整 `Fleet::Scene`。

当前测试通过 `scripts/query-m4.cjs` 执行 WebSocket 查询，并通过 `--action` 和 `--content` 传递操作名与 JSON 参数。脚本会自动解析 `sceneName`、裁剪响应；不要把原始响应交给模型。

## 门和电梯

基础设备查询：

```text
GET /api/fleet/scenes/{sceneId}/door
GET /api/fleet/scenes/{sceneId}/lift
```

门状态字段：`name`、`online`、`status`、`fault`、`faultMsg`、`openRobots`、`keepOpen`、`ut`。`status` 可能为 `Opened`、`Opening`、`Closing`、`Closed`、`Unknown`、`Ignored`。

电梯状态字段：`name`、`online`、`auto`、`fault`、`faultMsg`、`cfc`、`ca`、`ta`、`ds`、`people`、`ur`、`ts`、`q`。`cfc` 是当前楼层编码，`ca` 是当前区域，`ta` 是目标区域，`ds` 是各电梯门状态。

门/电梯配置（名称、禁用状态、楼层和关联区域）来自 Schema；门/电梯实时状态来自设备接口或 `Fleet::Scene`，不能混用。

## 货位占用

`fleetBins` 中使用：

- `binName`：货位名称。
- `areaId`：区域。
- `occupied`：是否占用。
- `container.containerId`、`container.containerTypeName`：容器信息。

货位配置和实时占用是两个概念。创建订单前先用点位/货位工具验证名称，再按请求需要查询 `fleetBins`。

## 控制接口

以下接口会改变实时系统，必须在执行前展示对象、当前状态和准确动作，并等待明确确认：

### 机器人

- `POST /api/fleet/robots/off-duty`：设置是否接收订单，参数 `{ sceneId, robotNames, offDuty }`。
- `POST /api/fleet/robots/master`：设置主控，参数 `{ sceneId, robotNames, on }`。
- `POST /api/fleet/robots/reconnect`：重连机器人，参数 `{ sceneId, robotNames }`。
- `POST /api/fleet/robots/{sceneId}/clear-alarm`：清除告警，参数 `{ robotNames }`。
- `POST /api/fleet/robots/pause-nav`：暂停导航，参数 `{ sceneId, robotNames }`。
- `POST /api/fleet/robots/resume-nav`：恢复导航，参数 `{ sceneId, robotNames }`。
- `POST /api/fleet/robots/cancel-nav`：取消导航，参数 `{ sceneId, robotNames }`。
- `POST /api/fleet/robots/{sceneId}/set-soft-emc`：设置软件急停，参数 `{ enable, robotNames }`。

### 门

- `POST /api/fleet/devices/doors/open-batch`：开门，参数 `{ sceneId, ids, remark }`。
- `POST /api/fleet/devices/doors/close-batch`：关门，参数 `{ sceneId, ids, remark }`。
- `POST /api/fleet/devices/doors/keep-open`：保持或取消保持开门，参数 `{ sceneId, ids, keepOpen, remark }`。

### 电梯

- `POST /api/fleet/devices/lifts/keep-open`：呼叫电梯到目标区域，参数 `{ sceneId, liftId, toAreaId, remark }`。
- `POST /api/fleet/devices/lifts/cancel-open`：取消电梯开门/呼叫，参数 `{ sceneId, liftId, remark }`。

这些接口是否在当前后端版本可用，应以真实响应为准；不支持时必须报告不可用，不得模拟设备状态。
