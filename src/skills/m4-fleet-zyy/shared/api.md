# M4 API 共享约定

上游参考文档：

- [M4 接口文档](https://seer-group.feishu.cn/wiki/Bct0wnDDwiWOivk9qAZcfARCnwf)
- [技能接口与规范文档](https://seer-group.feishu.cn/wiki/YM4ZwOPMQiB774kBrywc9wGonrb)

通用 HTTP 接口规范已整理到 [`m4-http-api.md`](m4-http-api.md)，包括认证、HTTP
状态码、实体查询和 CRUD、文件、机器人、WCS、统计、告警及 Agent 执行规则。

当前自动化环境无法读取这两个知识库页面的正文（返回飞书登录页），因此本目录的路径和请求体以仓库中的 M4 处理器和请求类为准；取得可读导出后应逐项对照更新。

## 地址和认证

默认地址是 `http://localhost:5800`，所有业务接口使用 `/api` 前缀。客户端支持：

- 用户会话：由 `M4_USER_ID_HEADER`、`M4_USER_TOKEN_HEADER` 配置（当前部署示例为 `x-xzz-qyq`、`x-xzz-qyx`）
- 应用凭据：`xyy-app-id=m4`、`xyy-app-key=m4` 要加到 header 里
- Cookie：`M4_AUTH_MODE=cookie` 和 `M4_COOKIE`

请求必须从环境变量或宿主机密钥存储读取认证信息。禁止在 `SKILL.md`、日志、请求 JSON 和对话中写入密钥。

## 领域路由

| 领域       | 路由前缀                                      | 主要能力                         |
| ---------- | --------------------------------------------- | -------------------------------- |
| 车队       | `/api/fleet/scenes`、`/api/fleet/robots`      | 场景、机器人、地图、交通、诊断   |
| 调度       | `/api/fleet/orders`                           | 运输单、步骤、优先级、取消、重试 |
| Falcon     | `/api/falcon`                                 | 任务定义、任务运行、全局变量     |
| 仓储       | `/api/wms`、`/api/order`                      | 容器、库存、出入库、订单推送     |
| WCS        | `/api/wcs/plc`、`/api/wcs/gw`、`/api/wcs/sto` | PLC、协议读写、设备运输单        |
| 机器人扩展 | `/api/robot`                                  | 单车控制、地图、重定位、I/O      |
| 平台       | `/api/base`、`/api/meta`、`/api/entity`       | 配置、元数据、实体和系统任务     |
| 云端集成   | `/api/aac`、`/api/external-call`              | 外部调用和集成服务               |

## 通用执行协议

1. 先 `GET /api/ping` 验证连通性和认证。
2. 对依赖 ID 的操作，先查询并使用响应中的真实 ID。
3. 只读请求可以并行；后一个请求依赖前一个响应时串行执行。
4. 创建、更新、删除、控制、写入和批量请求必须在调用前确认。
5. 不自动重试写请求；失败时保留 `code`、`message`、`args`。
6. 异步接口返回受理标识后必须查询状态，不能直接宣称完成。

## Agent Tool 边界

在 `web-agent-framework` 中，M4 API 应封装为受控 Tool，而不是让模型直接调用通用 `http_request`：

- `m4_read`：固定访问配置的 `M4_BASE_URL`，只接受相对 `/api/` 路径和 `GET`/查询型 `POST`，风险为低。
- `m4_write`：固定访问配置的 `M4_BASE_URL`，接受变更方法，风险为高，执行前由框架请求人工确认。

两个 Tool 都由服务端注入认证头，模型不能覆盖认证、主机或协议。HTTP 非 2xx 不会丢弃 M4 返回的 `code`、`message`、`args`；网络错误和路径安全错误则作为 Tool 错误处理。`SKILL.md` 负责领域流程和安全约束，Tool 负责参数校验、认证、网络请求和结果边界。

详细请求体以部署版本中的处理器和请求类为准。本目录中的技能文档提供常用路由和安全边界，不替代后端校验。
