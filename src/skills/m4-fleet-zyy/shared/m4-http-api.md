M4 HTTP 接口通用参考

# HTTP 通用逻辑

M4 HTTP 接口通常使用 `application/json; charset=utf-8`，路径从 `/api` 开始。输入参数缺失、类型错误或业务校验失败必须返回 HTTP 400；错误响应保留 M4 原始 `code`、`message` 和存在时的 `args`。认证失败返回 401，无权限返回 403，路径不存在返回 404，服务异常返回 500。

## Ping

**用法解释**：检查 M4 连通性、登录状态和当前用户。

**URL**
```http
GET /api/ping
```

**请求报文**：无。

**响应报文：`PingRes`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| id | 用户 ID | String | 是 | 当前用户 ID。 |
| username | 用户名 | String | 是 | 当前用户名。 |
| roAdmin | 只读管理员 | Boolean | 是 | 是否为只读管理员。 |
| permissions | 权限 | List<String> | 否 | 权限集合。 |

**请求示例**
```http
GET /api/ping
```

**响应示例**
```json
{"id":"__admin__","username":"admin","roAdmin":true,"permissions":null}
```

## 登录

**用法解释**：使用 M4 用户名密码建立登录会话。生产环境不得把凭据写入 Skill、日志或模型输出。

**URL**
```http
POST /api/sign-in
```

**请求报文：`SignInReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| username | 用户名 | String | 是 | M4 用户名。 |
| password | 密码 | String | 是 | M4 密码。 |

**响应报文：`SignInRes`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| userId | 用户 ID | String | 是 | 登录用户 ID。 |
| userToken | 用户令牌 | String | 是 | 服务端签发令牌。 |

**请求示例**
```json
{"username":"admin","password":"<由管理员提供>"}
```

**响应示例**
```json
{"userId":"__admin__","userToken":"server-issued-token"}
```

## 应用认证

**用法解释**：服务端代理应用请求时，在每次 HTTP 请求头中携带应用 ID 和密钥；模型不能自行生成或覆盖认证头。

**URL**：应用认证不是独立路径，随业务 URL 发送。

**请求报文：HTTP Header**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| xyy-app-id | 应用 ID | String | 是 | 管理员在“代理用户”中创建。 |
| xyy-app-key | 应用密钥 | String | 是 | 与应用 ID 配对。 |
| x-xzz-qyq | 用户 ID | String | 否 | 用户认证方式的请求头。 |
| x-xzz-qyx | 用户 Token | String | 否 | 用户认证方式的请求头。 |

**响应报文**：业务接口响应；认证失败为 HTTP 401。

**请求示例**
```http
GET /api/ping
xyy-app-id: app-001
xyy-app-key: <由服务端注入>
```

**响应示例**
```json
{"id":"app-001","username":"app-001","roAdmin":false,"permissions":null}
```

## HTTP 错误

**用法解释**：所有业务域共用此错误结构；参数错误必须为 HTTP 400。

**URL**：触发错误的原业务 URL。

**请求报文**：原业务请求。

**响应报文：`M4Error`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| code | 错误码 | String | 否 | M4 业务错误码。 |
| message | 错误信息 | String | 是 | 中文或英文错误信息。 |
| args | 错误参数 | List<Object> | 否 | 错误参数。 |

**请求示例**
```json
{"sceneId":null}
```

**响应示例**
```json
{"code":"errSceneIdBlank","message":"sceneId 不能为空","args":[]}
```

# Entity 通用接口

## 查询多个实体

**用法解释**：按条件查询实体数组，实体名和字段必须以部署元数据为准。

**URL**
```http
POST /api/entity/find/many
```

**请求报文：`FindManyReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| entityName | 实体名称 | String | 是 | 例如 `TransportOrder`。 |
| query | 查询条件 | ComplexQuery | 否 | null 表示不限定。 |
| fuzzy | 模糊搜索 | String | 否 | 实体支持时使用。 |
| projection | 返回字段 | List<String> | 否 | null 返回全部字段。 |
| sort | 排序 | List<String> | 否 | `-field` 倒序，`+field` 或无前缀正序。 |
| skip | 跳过数量 | Int | 否 | null 表示不跳过。 |
| limit | 最大数量 | Int | 否 | null 或负数表示不限制。 |

**响应报文：`List<Object>`**：数组元素是 `entityName` 对应的实体。

**请求示例**
```json
{"entityName":"TransportOrder","query":null,"projection":["id","status"],"sort":["-createdOn"],"limit":50}
```

**响应示例**
```json
[{"id":"TO20260824-000341P","status":"Executing"}]
```

## 分页查询实体

**用法解释**：按页查询实体，页号从 1 开始。

**URL**
```http
POST /api/entity/find/page
```

**请求报文：`FindPageReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| entityName | 实体名称 | String | 是 | 实体名称。 |
| query | 查询条件 | ComplexQuery | 否 | 查询条件。 |
| fuzzy | 模糊搜索 | String | 否 | 模糊文本。 |
| projection | 返回字段 | List<String> | 否 | 返回字段。 |
| sort | 排序 | List<String> | 否 | 排序字段。 |
| pageNo | 页号 | Int | 是 | 从 1 开始。 |
| pageSize | 每页数量 | Int | 是 | 大于 0。 |

**响应报文：`FindPageResult<Object>`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| pageNo | 页号 | Int | 是 | 当前页。 |
| pageSize | 每页数量 | Int | 是 | 页大小。 |
| total | 总数 | Long | 是 | 命中总数。 |
| page | 当前页数据 | List<Object> | 是 | 实体数组。 |

**请求示例**
```json
{"entityName":"TransportOrder","query":null,"pageNo":1,"pageSize":50,"sort":["-createdOn"]}
```

**响应示例**
```json
{"pageNo":1,"pageSize":50,"total":1,"page":[{"id":"TO20260824-000341P","status":"Executing"}]}
```

## 查询一个实体

**用法解释**：按 ID 或查询条件返回第一个匹配实体。

**URL**
```http
POST /api/entity/find/one
```

**请求报文：`FindOneReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| entityName | 实体名称 | String | 是 | 实体名称。 |
| id | 实体 ID | String | 否 | 按 ID 查询。 |
| query | 查询条件 | ComplexQuery | 否 | 与 id 二选一或不传。 |
| projection | 返回字段 | List<String> | 否 | 返回字段。 |
| sort | 排序 | List<String> | 否 | 排序字段。 |

**响应报文：`FindOneRes<Object>`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| entityValue | 实体值 | Object | 否 | 找不到时为 null。 |

**请求示例**
```json
{"entityName":"TransportOrder","id":"TO20260824-000341P","projection":["id","status"]}
```

**响应示例**
```json
{"entityValue":{"id":"TO20260824-000341P","status":"Executing"}}
```

## 创建实体

**用法解释**：创建一个或多个实体，属于写操作。

**URL**
```http
POST /api/entity/create/one
```

**请求报文：`CreateEntityReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| entityName | 实体名称 | String | 是 | 实体名称。 |
| entityValue | 实体值 | Object | 是 | 依实体元数据填写。 |

**响应报文：`CreateEntityRes`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| id | 新实体 ID | String | 否 | 创建结果。 |

**请求示例**
```json
{"entityName":"Example","entityValue":{"name":"demo"}}
```

**响应示例**
```json
{"id":"EX-001"}
```

## 更新实体

**用法解释**：按 ID 更新实体部分字段，属于写操作。

**URL**
```http
POST /api/entity/update/one
```

**请求报文：`UpdateEntityReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| entityName | 实体名称 | String | 是 | 实体名称。 |
| id | 实体 ID | String | 是 | 待更新实体。 |
| update | 更新字段 | Map<String, Object> | 是 | 部分字段。 |

**响应报文：`UpdateEntityRes`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| updatedCount | 更新数量 | Int | 是 | 成功更新数量。 |

**请求示例**
```json
{"entityName":"Example","id":"EX-001","update":{"name":"new-name"}}
```

**响应示例**
```json
{"updatedCount":1}
```

## 删除实体

**用法解释**：按 ID 或查询条件删除实体，属于写操作。

**URL**
```http
POST /api/entity/remove/one
```

**请求报文：`RemoveEntityReq`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| entityName | 实体名称 | String | 是 | 实体名称。 |
| id | 实体 ID | String | 是 | 待删除实体。 |

**响应报文：`RemoveEntityRes`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| removedCount | 删除数量 | Int | 是 | 成功删除数量。 |

**请求示例**
```json
{"entityName":"Example","id":"EX-001"}
```

**响应示例**
```json
{"removedCount":1}
```

# 文件

## 上传文件

**用法解释**：上传文件，返回后续访问所需路径。上传是写操作，使用 multipart/form-data。

**URL**
```http
POST /api/files/upload
```

**请求报文：`multipart/form-data`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| f0 | 文件 | File | 是 | 上传文件字段。 |

**响应报文：`UploadFileRes`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| originalName | 原文件名 | String | 是 | 原始名称。 |
| size | 文件大小 | Long | 是 | 字节数。 |
| path | 文件路径 | String | 是 | 后续下载路径。 |

**请求示例**
```http
POST /api/files/upload
Content-Type: multipart/form-data
```

**响应示例**
```json
{"originalName":"scene.smap","size":1024,"path":"uploads/scene.smap"}
```

## 下载文件

**用法解释**：读取已授权的文件路径。

**URL**
```http
GET /api/files/get/{path}
```

**请求报文**：路径参数 `path` 为 String，必填。

**响应报文**：文件二进制流，`Content-Type` 由文件类型决定。

**请求示例**
```http
GET /api/files/get/uploads/scene.smap
```

**响应示例**
```http
HTTP/1.1 200 OK
Content-Type: application/octet-stream
```

# WebSocket 通用逻辑

## 建立 WebSocket 连接

**用法解释**：M4 WebSocket 地址固定为 `/wsm`，认证头在握手时发送。

**URL**
```text
ws://{m4_ip}:{m4_port}/wsm
```

**请求报文：HTTP Header**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| xyy-app-id | 应用 ID | String | 否 | 与 `xyy-app-key` 成对。 |
| xyy-app-key | 应用密钥 | String | 否 | 应用认证。 |
| x-xzz-qyq | 用户 ID | String | 否 | 用户认证。 |
| x-xzz-qyx | 用户 Token | String | 否 | 用户认证。 |

**响应报文**：握手成功为 101；认证错误以 `WsMsg` 错误消息返回。

**请求示例**
```text
ws://127.0.0.1:5800/wsm
Headers: xyy-app-id: app-001; xyy-app-key: <由服务端注入>
```

**响应示例**
```text
WebSocket 101 Switching Protocols
```

## WebSocket 消息

**用法解释**：业务请求和响应都使用同一外层消息；`content` 是序列化 JSON 字符串。

**URL**：已建立的 WebSocket 连接。

**请求报文：`WsMsg`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| id | 请求 ID | String | 否 | 响应 `replyToId` 对应此值。 |
| action | 请求指令 | String | 是 | 具体 WebSocket action。 |
| content | 请求内容 | String | 是 | JSON 序列化后的实体。 |

**响应报文：`WsMsg`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| action | 响应指令 | String | 是 | 请求 action 加 `::Reply` 或 `::Error`。 |
| content | 响应内容 | String | 是 | 序列化后的响应实体。 |
| id | 响应 ID | String | 是 | 服务端生成或为空。 |
| replyToId | 对应请求 ID | String | 是 | 请求 `id`。 |
| userIds | 用户 ID | List<String> | 否 | 广播目标。 |

**请求示例**
```json
{"id":"req-001","action":"Fleet3::RobotsPositionOnly::Query","content":"{\"sceneId\":\"scene-001\"}"}
```

**响应示例**
```json
{"action":"Fleet3::RobotsPositionOnly::Query::Reply","content":"{\"robots\":{}}","id":"","replyToId":"req-001","userIds":null}
```

# 查询条件

## ComplexQuery

**用法解释**：实体查询、场景过滤和资源筛选共用此条件实体。

**URL**：由具体查询接口承载。

**请求报文：`ComplexQuery`**

| 名称 | 含义 | 类型 | 必填（可为空） | 说明 |
| --- | --- | --- | --- | --- |
| type | 查询类型 | ComplexQueryType | 是 | Compound、General、All。 |
| or | OR 查询 | Boolean | 否 | Compound 中 true 表示 OR。 |
| not | NOT 查询 | Boolean | 否 | 是否取反。 |
| operator | 查询方式 | ComplexQueryOperator | 否 | Eq、Ne、Gt、Gte、Lt、Lte、In、Between、Contain、ContainIgnoreCase、Start、End、Null、NotNull、Empty、NotEmpty、CurrentUser、CurrentUsername、ThisWeek。 |
| field1 | 查询字段 1 | String | 否 | 普通查询字段。 |
| field2 | 查询字段 2 | String | 否 | 二元比较字段。 |
| value | 查询值 | Object | 否 | 与 operator 对应。 |
| items | 子条件 | List<ComplexQuery> | 否 | Compound 子条件。 |

**响应报文**：查询接口返回业务实体，不单独返回 `ComplexQuery`。

**请求示例**
```json
{"type":"Compound","or":false,"items":[{"type":"General","field1":"status","operator":"Eq","value":"Done"}]}
```

**响应示例**
```json
[{"id":"TO20260824-000341P","status":"Done"}]
```

# Agent 调用规则

## 执行 M4 请求

**用法解释**：首次访问先调用 Ping；依赖真实 ID 时先查询；读请求使用 `m4_read`，创建、更新、删除、控制、上传和写入使用 `m4_write`。写操作执行前必须确认目标、请求体和影响范围，不自动重试。

**URL**：由具体接口决定。

**请求报文**：使用具体接口定义的实体名和字段。

**响应报文**：保留 HTTP 状态、业务响应以及错误 `code`、`message`、`args`。

**请求示例**
```text
先 GET /api/ping，再调用目标接口
```

**响应示例**
```text
HTTP 200：按接口返回；HTTP 400：按 M4Error 返回
```
