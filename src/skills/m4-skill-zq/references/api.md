# M4 API 参考

前端使用 `/api/` 作为 HTTP 基础路径。以下操作需要经过身份验证的会话。

## API 认证

调用以下 M4 API 时，必须携带请求头：

baseUrl 是 http://localhost:5800

```http
xyy-app-id: zq-ai-test
xyy-app-key: zq-ai-test
```

## 场景发现

### `GET /api/fleet/scenes/list`

使用此接口将面向用户的场景名称解析为 ID。只能选择唯一且 `disabled: false` 的场景。

相关响应字段：

```json
[{ "id": "scene-001", "name": "Example", "disabled": false }]
```

### `GET /api/fleet/scenes/schema/{sceneId}`

创建订单前，使用此接口验证位置和可选的机器人限制。检查 `structure.areas`、`structure.robots` 和 `structure.robotGroups`。步骤位置必须是场景中已知的真实点位或货位。

## 运行时状态

### WebSocket 操作 `Fleet::Scene`

请求：

```json
{
  "sceneId": "scene-001",
  "excluded": [],
  "orderQueryType": "NoFinishedOrders"
}
```

响应包含场景状态、暂停状态、机器人、订单和运行时诊断信息。当当前调度或机器人状态很重要时使用它。如果执行环境无法调用 M4 WebSocket，应说明实时验证不可用。

## 订单

### `POST /api/fleet/orders/create`

创建普通运输订单。JSON 请求体定义于 [order-schema.md](order-schema.md)。

典型成功响应：

```json
{ "orderId": "generated-order-id", "externalId": null }
```

创建成功表示订单已被接受，并不表示机器人已经开始执行。

### `GET /api/fleet/orders/query-order-detail?orderId={orderId}`

查询单个订单及其步骤。检查 `status`、`actualRobotName`、`fault`、`faultReason`、`currentStepIndex` 和 `steps`。

等效的 WebSocket 操作为 `Fleet::OrderDetail`，参数为 `{ "orderId": "..." }`。

### `POST /api/fleet/orders/cancel`

请求：

```json
{ "sceneId": "scene-001", "orderId": "order-id" }
```

这是修改操作，需要确认。成功响应为 HTTP 200，响应体不是必需的。

### `POST /api/fleet/orders/set-suspended`

请求：

```json
{ "orderIds": ["order-id"] }
```

### `POST /api/fleet/orders/unset-suspended`

请求：

```json
{ "orderIds": ["order-id"] }
```

这两个暂停操作都会修改实时订单，需要确认。

## 调度暂停

### `POST /api/fleet/scenes/{sceneId}/dispatch-pause`

请求：

```json
{ "paused": true }
```

仅当操作员明确要求暂停或恢复场景调度时使用。这与创建订单是分开的操作。

## 错误

- `401`：缺少身份验证或身份验证已过期。
- `403`：账户没有权限。
- `404`：未找到场景、位置或订单。
- `500`：后端故障。
- 业务错误响应优先于笼统的成功措辞；报告失败时保留其消息。
