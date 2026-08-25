---
name: m4-skill-zq-test
description: 使用 M4 调度车队系统解析场景和位置、创建运输订单、检查订单与机器人状态，并执行已确认的取消或暂停等订单操作。用于 M4 场景请求；如果没有 M4 系统访问权限，不要将其用于 M4 物流建议。
---

# M4 运营

使用此 Skill 将操作员的请求转化为经过验证的 M4 操作。

## 操作原则

- 将 M4 视为实时控制系统。做决定前先读取当前数据。
- 将人类可读的场景名称解析为一个已启用的 `sceneId`；绝不臆造 ID、点位、机器人或容器。
- 保持订单创建、机器人分配和步骤执行彼此独立。
- 在创建、取消、暂停或以其他方式修改订单之前，立即要求明确确认。
- 准确报告后端结果和当前状态。不能仅因订单已创建就称其成功。
- 如果所需的 M4 API/工具不可用，应说明无法执行该操作；不要模拟成功。
- 不要请求或接收完整场景 Schema。根据需要分别调用点位、货位、机器人或机器人组工具，并使用关键词和分页缩小结果。

## 工具路由

- 需要查询实时时，例如：机器人、门、容器等的状态，执行 `scripts/query-m4.cjs`；脚本会先将 `sceneName` 解析为唯一启用的 `sceneId`，再调用 WebSocket。
- 任何 WebSocket 查询前，必须先将用户提供的场景名称解析为唯一启用的 `sceneId`；不得将场景名称直接作为 ID。
- 查询实时场景状态：使用 `Fleet::Scene`，只请求所需模块；不要把完整响应直接交给模型。
- 查询轻量机器人位置：使用 `Fleet3::RobotsPositionOnly::Query`。
- 查询门/电梯状态：使用设备状态接口或 `Fleet::Scene` 返回的 `doors`、`lifts`。
- 当前测试 Agent 只支持查询，不支持创建、取消、暂停订单或机器人、门、电梯控制。

宿主 Agent 只需要具备 Skill 脚本执行能力；当前测试入口是 `scripts/query-m4.cjs`。Skill 不依赖固定的 M4 工具名称或 MCP Server。

## 请求路由

- 创建从一个位置到另一个位置的搬运：阅读 [references/order-schema.md](references/order-schema.md) 和 [workflows/create-order.md](workflows/create-order.md)。
- 检查订单、机器人或场景：阅读 [references/api.md](references/api.md) 和 [references/status-model.md](references/status-model.md)。
- 检查机器人、门、电梯、货位占用或调度运行态：阅读 [references/runtime-status.md](references/runtime-status.md)。
- 需要查询 WebSocket 时，执行 [scripts/query-m4.cjs](scripts/query-m4.cjs)，规则见 [references/scripts.md](references/scripts.md)。
- 调用脚本时优先使用 `--scene-name`、`--scene-id`、`--order-id` 等普通参数；不要让模型自行拼接带嵌套引号的 shell JSON。
- 执行 WebSocket 脚本前，确认宿主机已安装 Node.js 22+；交付的 bundle 已包含 `ws`，不需要额外安装 npm 依赖。
- 取消、暂停或恢复订单：阅读 [references/api.md](references/api.md) 和 [workflows/order-control.md](workflows/order-control.md)。
- 解读分配和调度行为：阅读 [references/dispatch-rules.md](references/dispatch-rules.md)。

## 核心流程

1. 确定请求中的场景、操作、位置、容器信息、机器人限制和所需的确认模式。
2. 查询场景并解析出唯一的已启用场景。
3. 根据请求调用 Skill 脚本查询所需的运行时或配置数据，验证相关实体。
4. 当请求依赖调度、机器人可用性或订单状态时，查询当前运行时状态。
5. 使用订单架构构建最小请求。
6. 在 dry-run 模式下展示请求并停止；否则展示简洁的操作摘要并等待确认。
7. 执行已确认的 API 操作。
8. 返回标识符和后端结果；在用户要求或需要解释结果时，再查询状态。

## 范围

此版本涵盖普通运输订单、订单状态、场景运行时状态和基本订单控制。停车、充电、Falcon 流程、地图编辑、WCS 设备控制和 WMS 业务流程需要专门的参考资料和工具；不要从普通运输订单推断这些请求的格式。
