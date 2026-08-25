# Skill 查询脚本

`scripts/query-m4.cjs` 是面向 Agent 的一次性查询入口。它会先用 HTTP 场景列表接口解析 `sceneName`，再调用内置依赖的 `query-ws.bundle.cjs`；只输出精简 JSON，错误输出到 stderr。Agent 优先使用普通参数，不要自行拼接 shell 引号。

## 前置条件

宿主机只需要安装 Node.js 22 或更高版本。交付时优先使用已经打包 `ws` 依赖的单文件脚本：

```powershell
node <m4-skill目录>/scripts/query-m4.cjs --action Fleet::Scene --content '{"sceneName":"test3D","excluded":["traffic"],"orderQueryType":"NoFinishedOrders"}'
node <m4-skill目录>/scripts/query-m4.cjs --action Fleet::Scene --scene-name test3D --excluded traffic --order-query-type NoFinishedOrders
```

`query-ws.bundle.cjs` 已将 `ws` 打入文件，不需要额外 `npm install`，也不要把 `node_modules` 打包进 Skill。它是内部实现文件，Agent 应执行 `query-m4.cjs`，不要直接调用 bundle。

## 使用

```powershell
node scripts/query-m4.cjs --action Fleet::Scene --content '{"sceneName":"test3D","excluded":["traffic"],"orderQueryType":"NoFinishedOrders"}'
node scripts/query-m4.cjs --action Fleet::Scene --scene-name test3D --excluded traffic --order-query-type NoFinishedOrders
node scripts/query-m4.cjs --action Fleet3::RobotsPositionOnly::Query --scene-name test3D
node scripts/query-m4.cjs --action Fleet::OrderDetail --order-id order-id
```

## 环境变量

- `M4_WS_URL`：WebSocket 地址，默认 `ws://127.0.0.1:5800/wsm`。
- `M4_WS_TIMEOUT_MS`：响应超时，默认 15000。
- `M4_WS_USER`、`M4_WS_PAGE_ID`：宿主会话需要时设置。
- `M4_WS_COOKIE`：浏览器登录态 Cookie；如果后端依赖登录会话，必须提供。
- `M4_APP_ID`、`M4_APP_KEY`：脚本会在 WebSocket 握手时作为 `xyy-app-id`、`xyy-app-key` 请求头发送；不要把凭据写进 Skill 或命令行参数。

脚本复刻前端的请求封装：`id`、`action`、`content`，响应使用 `replyToId` 匹配。脚本使用 Node `ws` 客户端，并可在握手时传递 `M4_WS_COOKIE`、`xyy-app-id` 和 `xyy-app-key`。后端如果只接受浏览器登录 Cookie，必须提供有效的 `M4_WS_COOKIE`。

脚本每次执行都会建立并关闭一次连接，适合低频验证，不适合订阅和高频实时查询。不要将原始 WebSocket 响应直接传给模型。
