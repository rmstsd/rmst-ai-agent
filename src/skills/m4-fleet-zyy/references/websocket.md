# WebSocket 通用协议

## 建立 WebSocket 连接

**用法解释**：M4 WebSocket 用于实时查询和事件式响应。身份信息放在连接请求头；优先使用应用凭据，不能由模型生成或覆盖。

**URL**
```text
ws://{m4_ip}:{m4_port}/wsm
```

**请求报文**：连接请求头。

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| xyy-app-id | 应用 ID | String | 否 | 与 `xyy-app-key` 成对使用。 |
| xyy-app-key | 应用密钥 | String | 否 | 由 M4 “代理用户”生成。 |
| x-xzz-qyq | 用户 ID | String | 否 | 使用用户认证时传入。 |
| x-xzz-qyx | 用户 Token | String | 否 | 使用用户认证时传入。 |

**响应报文**：连接成功后无固定正文；认证失败时随后返回 `::Error` 消息。

**请求示例**
```text
ws://127.0.0.1:5800/wsm
Headers: xyy-app-id: app-001; xyy-app-key: <由服务端注入>
```

**响应示例**
```text
WebSocket 101 Switching Protocols
```

## WebSocket 请求消息

**用法解释**：每条消息的 `content` 必须是序列化后的 JSON 字符串。`id` 用于把响应和请求关联。

**URL**：使用已建立的 WebSocket 连接，不重复填写 HTTP URL。

**请求报文：`WsMsg`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| id | 请求 ID | String | 否 | 唯一标识；填写后响应的 `replyToId` 原样返回。 |
| action | 请求指令 | String | 是 | 例如 `Fleet::OrderDetail`。 |
| content | 请求内容 | String | 是 | JSON 序列化字符串。无正文时按部署版本传 null 或 `{}`。 |

**响应报文**：对应 action 的 `::Reply` 或 `::Error` 消息，实体见具体接口。

**请求示例**
```json
{"id":"req-001","action":"Fleet::OrderDetail","content":"{\"orderId\":\"TO20260824-000341P\"}"}
```

**响应示例**
```json
{"action":"Fleet::OrderDetail::Reply","content":"{\"id\":\"TO20260824-000341P\",\"status\":\"Executing\"}","id":"","replyToId":"req-001","userIds":null}
```

## WebSocket 响应消息

**用法解释**：响应外层结构固定；`content` 反序列化后才是具体业务实体。

**URL**：同请求使用的 WebSocket 连接。

**请求报文**：无，服务端主动返回。

**响应报文：`WsMsg`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| action | 响应指令 | String | 是 | 请求 action 拼接 `::Reply`，错误时拼接 `::Error`。 |
| content | 响应内容 | String | 是 | 序列化后的业务实体；错误消息可能为空。 |
| id | 响应 ID | String | 是 | 服务端生成或为空。 |
| replyToId | 对应请求 ID | String | 是 | 对应请求的 `id`。 |
| userIds | 用户 ID | List<String> | 否 | 广播目标；通常为 null。 |

**请求示例**
```text
无
```

**响应示例**
```json
{"action":"Fleet3::RobotsPositionOnly::Query::Reply","content":"{\"robots\":{}}","id":"","replyToId":"req-002","userIds":null}
```

# 运单 WebSocket

## 查询运单详情

**用法解释**：通过 WebSocket 查询单个运单的实体详情及步骤。部署源码注册的 action 为 `Fleet::OrderDetail`；兼容客户端可使用 `Fleet::OrderDetail::Query`，实际响应均按收到的 action 拼接 `::Reply`。

**URL**
```text
ws://{m4_ip}:{m4_port}/wsm
```

**请求报文：`OrderDetailWsReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| orderId | 运单 ID | String | 是 | 待查询运单。 |

**响应报文：`OrderDetail`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| id | 运单 ID | String | 是 | 运单实体字段。 |
| status | 单据状态 | OrderStatus | 是 | 运单状态枚举。 |
| sceneId | 场景 ID | String | 是 | 所属场景。 |
| steps | 步骤列表 | List<TransportStep> | 是 | 字段复用调度文档“查询单个运单详情”的 `TransportStep`。 |
| allocationReject | 分派拒绝 | String | 否 | 调度运行时拒绝原因。 |
| executionReject | 执行拒绝 | String | 否 | 执行运行时拒绝原因。 |

其余运单字段复用调度文档 `TransportOrder`。

**请求示例**
```json
{"id":"req-001","action":"Fleet::OrderDetail","content":"{\"orderId\":\"TO20260824-000341P\"}"}
```

**响应示例**
```json
{"action":"Fleet::OrderDetail::Reply","content":"{\"id\":\"TO20260824-000341P\",\"sceneId\":\"695CC8F12878603D13E98814\",\"status\":\"Executing\",\"steps\":[]}","id":"","replyToId":"req-001","userIds":null}
```

# 机器人 WebSocket

## 查询全部机器人 UI 报告

**用法解释**：适合低频或完整状态刷新；高频位置刷新使用下一个接口。

**URL**
```text
ws://{m4_ip}:{m4_port}/wsm
```

**请求报文：`SceneIdReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| sceneId | 场景 ID | String | 是 | 目标场景。 |

**响应报文：`Map<String, RobotUiReport>`**：Map 键是机器人名称，`RobotUiReport` 字段复用 HTTP `RobotUiReport`。

**请求示例**
```json
{"id":"req-002","action":"Fleet3::AllRobotsUiReports::Query","content":"{\"sceneId\":\"695CC8F12878603D13E98814\"}"}
```

**响应示例**
```json
{"action":"Fleet3::AllRobotsUiReports::Query::Reply","content":"{\"Box-02\":{\"robotName\":\"Box-02\",\"online\":true}}","id":"","replyToId":"req-002","userIds":null}
```

## 查询机器人位置

**用法解释**：高频查询机器人位置、目标点和已规划路径。

**URL**
```text
ws://{m4_ip}:{m4_port}/wsm
```

**请求报文：`SceneIdReq`**：字段同“查询全部机器人 UI 报告”。

**响应报文：`RobotsPosition`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| robots | 机器人位置 Map | Map<String, RobotPositionOnly> | 是 | 键为机器人名称。 |
| replyTimestamp | 响应时间 | Long | 是 | Unix 毫秒时间戳。 |

`RobotPositionOnly` 字段：`x: Double`、`y: Double`、`d: Double`、`loads: List<Object>`、`targetPoint: String`、`travelled: List<String>`、`unTravelled: List<String>`、`remainingPaths: List<String>`、`spaces: List<Object>`，均可为空。

**请求示例**
```json
{"id":"req-003","action":"Fleet3::RobotsPositionOnly::Query","content":"{\"sceneId\":\"695CC8F12878603D13E98814\"}"}
```

**响应示例**
```json
{"action":"Fleet3::RobotsPositionOnly::Query::Reply","content":"{\"robots\":{\"Box-02\":{\"x\":4.2,\"y\":-31.1,\"d\":1.57,\"targetPoint\":\"AP2483\"}},\"replyTimestamp\":1768296469100}","id":"","replyToId":"req-003","userIds":null}
```

# 场景 WebSocket

## 查询场景实时数据

**用法解释**：返回场景状态、机器人、运单、派单、交通、门、电梯和外部地图资源，可通过 `excluded` 减少数据量。部署源码 action 为 `Fleet::Scene`；部分 M4 客户端将其命名为 `Fleet3::Scene`，以当前部署注册的 action 为准。

**URL**
```text
ws://{m4_ip}:{m4_port}/wsm
```

**请求报文：`SceneQueryWsReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| sceneId | 场景 ID | String | 是 | 目标场景。 |
| excluded | 排除模块 | List<String> | 否 | 例如 robots、orders、traffic、sceneConfig。 |
| withRawReport | 返回原始机器人报文 | Boolean | 否 | 默认 false。 |
| orderQueryType | 运单查询范围 | OrderQueryType | 否 | AllOrders、NoFinishedOrders、FaultOrders。 |
| rawFields | 原始报文字段 | List<String> | 否 | 指定字段。 |

**响应报文：`SceneRuntimeSnapshot`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| status | 场景状态 | String | 是 | 场景运行状态。 |
| pauseStatus | 调度暂停状态 | String | 是 | 当前暂停状态。 |
| robots | 机器人报告 | Map<String, RobotUiReport> | 否 | 未排除 robots 时返回。 |
| orders | 运单列表 | List<TransportOrder> | 否 | 未排除 orders 时返回。 |
| goingCount | 执行中数量 | Int | 否 | 运单统计。 |
| faultCount | 故障数量 | Int | 否 | 运单统计。 |
| dispatchProfile | 派单统计 | Map<String, Object> | 否 | 调度统计。 |
| trafficDebug | 交通调试 | Map<String, Object> | 否 | 交管调试信息。 |
| sceneConfig | 场景配置 | SceneConfigAll | 否 | 未排除 sceneConfig 时返回。 |
| doors | 门状态 | Map<String, Object> | 否 | 门实时状态。 |
| lifts | 电梯状态 | Map<String, Object> | 否 | 电梯实时状态。 |
| externalMapRes | 外部资源 | List<SpaceResource> | 否 | 外部地图资源。 |
| replyTimestamp | 响应时间 | Long | 是 | Unix 毫秒时间戳。 |

**请求示例**
```json
{"id":"req-004","action":"Fleet::Scene","content":"{\"sceneId\":\"695CC8F12878603D13E98814\",\"excluded\":[\"trafficDebug\"]}"}
```

**响应示例**
```json
{"action":"Fleet::Scene::Reply","content":"{\"status\":\"Running\",\"pauseStatus\":\"Running\",\"robots\":{},\"orders\":[],\"goingCount\":0,\"faultCount\":0,\"replyTimestamp\":1768296469100}","id":"","replyToId":"req-004","userIds":null}
```

# 错误

## WebSocket 参数错误

**用法解释**：请求 `content` JSON 无法反序列化、字段缺失或业务参数错误时，服务端返回错误消息；HTTP 类似错误对应 HTTP 400。

**URL**
```text
ws://{m4_ip}:{m4_port}/wsm
```

**请求报文**：任一合法 `WsMsg`。

**响应报文：`WsError`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| error | 错误状态 | Int | 是 | 参数错误为 400，认证错误为 401，服务端错误为 500。 |
| code | M4 错误码 | String | 否 | 保留原值。 |
| message | 错误信息 | String | 否 | 保留原值。 |
| args | 错误参数 | List<Object> | 否 | 保留原值。 |

**请求示例**
```json
{"id":"req-005","action":"Fleet3::RobotsPositionOnly::Query","content":"{\"sceneId\":null}"}
```

**响应示例**
```json
{"action":"Fleet3::RobotsPositionOnly::Query::Error","content":"{\"error\":400,\"code\":\"errSceneIdBlank\",\"message\":\"sceneId 不能为空\",\"args\":[]}","id":"","replyToId":"req-005","userIds":null}
```
