# M4 MCP Server

MCP Server 是可选的独立执行方式，不是本 Skill 的必要依赖。本测试 Skill 使用 `scripts/query-m4.cjs`，宿主 Agent 只需要能够执行 Skill 脚本。

如果宿主 Agent 已经提供 MCP 工具，可以用兼容工具替代脚本；否则不要假设以下 MCP 工具存在。

## 启动

```powershell
cd <m4-mcp-server目录>
npm install
npm run build
```

在支持 MCP 的 Agent 中，将命令配置为：

```text
node <m4-mcp-server目录>/dist/index.js
```

路径应指向 MCP Server 的实际安装位置，不要相对于 `m4-skill` 目录解析。

可配置环境变量：

- `M4_BASE_URL`：默认 `http://127.0.0.1:5800/api`。
- `M4_APP_ID`、`M4_APP_KEY`：覆盖内置本地测试凭据。
- `M4_SCHEMA_CACHE_TTL_MS`：Schema 缓存时间，默认 60000 毫秒。

测试环境可以使用 MCP Server 内置的测试凭据。生产环境必须通过 Secret 或环境变量提供凭据，不应将凭据写入 Skill 包。

## 可选 MCP 约定

如果未来接入 MCP，应提供与 Skill 脚本行为等价的语义化查询工具，并在工具服务端完成认证、过滤、分页和错误处理。当前测试 Agent 没有这些 MCP 工具，不能直接调用本文件中未注册的工具。
