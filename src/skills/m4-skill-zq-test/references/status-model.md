# M4 状态模型

## 场景

- `Disabled`：场景已禁用。
- `Initializing`：场景正在启动或加载。
- `Initialized`：场景已准备好进行正常运行时操作。
- `Disposed`：场景运行时已释放。

## 调度暂停

- `Running`：调度正在运行。
- `Pausing`：已请求暂停；现有移动可能仍在收尾。
- `Paused`：调度已暂停。

暂停状态与订单创建相互独立。调度暂停时，已创建的订单可能保持未分配状态。

## 机器人

- `online=false`：当前没有有效在线上报；不等于配置中的 `disabled=true`。
- `sysStatus=Ok`：机器人系统正常；`Error` 或 `Crushed` 表示不能按正常能力执行任务。
- `cmdStatus=Idle`：当前没有执行运单；`Moving`：正在执行；`Failed`：执行失败。
- `blocked=true`：机器人被阻挡；必须结合 `blockedMsg`、阻挡机器人/货架和告警判断原因。
- `emc=true` 或 `softEmc=true`：急停状态，不能报告为可正常执行。
- `offDuty=true`：不接收新订单；不代表机器人离线。
- `currentMapNotMatched=true`：当前地图与场景配置不匹配，派单前需要人工处理。

## 门

门状态：`Opened`、`Opening`、`Closing`、`Closed`、`Unknown`、`Ignored`。`online=false` 或 `fault=true` 时不能声称门可用；`openRobots` 表示当前请求保持开门的机器人。

## 电梯

电梯状态需要同时查看 `online`、`auto`、`fault`、当前区域/楼层、目标区域、门状态 `ds` 和任务状态 `ts`。只有在线、自动、无故障且门状态满足流程时，才能判断电梯可调度。

## 货位

- 配置货位存在，不代表当前有货或可用。
- `fleetBins[].occupied` 表示实时占用。
- `container` 非空时报告容器 ID 和类型；不要从配置推断容器存在。

## 订单

- `ToBeAllocated`：等待机器人分配。
- `Pending`：已分配或处于可执行步骤之间，当前没有正在执行的步骤。
- `Allocated`：用于旧版兼容的状态；新逻辑不要依赖它。
- `Executing`：某个步骤正在执行。
- `Done`：已成功完成。
- `Cancelled`：取消已完成。

`fault=true` 表示执行遇到故障；不得将其报告为成功。非空的 `actualRobotName` 表示已完成分配，不表示已完成订单。
