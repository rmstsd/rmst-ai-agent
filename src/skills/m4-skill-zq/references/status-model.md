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

## 订单

- `ToBeAllocated`：等待机器人分配。
- `Pending`：已分配或处于可执行步骤之间，当前没有正在执行的步骤。
- `Allocated`：用于旧版兼容的状态；新逻辑不要依赖它。
- `Executing`：某个步骤正在执行。
- `Done`：已成功完成。
- `Cancelled`：取消已完成。

`fault=true` 表示执行遇到故障；不得将其报告为成功。非空的 `actualRobotName` 表示已完成分配，不表示已完成订单。
