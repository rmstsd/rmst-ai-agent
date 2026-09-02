# rmst-ai-agent

这是将 M4 后端 `AiHandler.kt` 的 AI 对话逻辑重构为 Next.js 的个人学习项目，包含：

- LangChain 原生 Agent + LangGraph 内存会话和上下文串联
- SSE 流式对话、工具调用和人工审批闭环
- 火山引擎录音转文字
- Next.js Route Handlers 后端与 React 聊天界面
- 从 `src/skills` 按需发现和加载 Skills
- Tailwind CSS 4 和 SCSS

## 配置

打开 `src/config/ai-config.ts`，填写：

- `ark.apiKey`
- `ark.modelId`
- `m4.baseUrl`
- `m4.appId`
- `m4.appKey`
- `speech.appId`
- `speech.token`

项目按学习用途直接读取该配置文件，没有把这些变量自动抽离为环境变量。提交到公开仓库前请不要填写真实密钥。

`m4.appId` 和 `m4.appKey` 对应 M4 后端的 `AgentUser`。Node.js 会通过 M4 的受认证桥接接口加载并执行以下原生能力：

- `FleetAiArkManager` 注册的机器人、运单和诊断工具
- `StoreAi` 注册的库存查询工具
- `LogAi` 注册的时间和日志工具

业务判断仍在 M4 进程中执行，Next.js 不复制调度、库存和实体服务逻辑。

## 启动

```bash
npm install
npm run dev
```

访问 `http://localhost:8666`。

## API

- `GET /api/ai/session`：获取会话列表
- `POST /api/ai/session`：创建会话（可传 `{ "title": "会话标题" }`）
- `GET /api/ai/session/:sessionId`：读取会话消息和待审批动作
- `PATCH /api/ai/session/:sessionId`：更新会话标题
- `DELETE /api/ai/session/:sessionId`：删除会话及其 LangGraph 线程状态
- `POST /api/ai/chat`：发送消息并返回 SSE
- `POST /api/ai/approval`：提交工具调用的人工审批决定并返回 SSE
- `POST /api/ai/stop`：停止当前生成

浏览器端所有通信封装在 `src/api/ai-api.ts`，没有使用 Server Actions。

## Skills

每个 Skill 固定存放在 `src/skills/<skill-name>/SKILL.md`，其中 `SKILL.md` 必须包含 `name` 和 `description` frontmatter，且 `name` 与目录名一致。Agent 启动时注册工作区工具，并通过 `read_skill` 按需读取 Skill 的完整内容及其脚本、参考资料。

会话元数据保存在 SQLite 的 `session` 表中，LangGraph 线程状态由 `SqliteSaver` 持久化到同一数据库。浏览器会在刷新时恢复本地保存的 `sessionId`，服务重启后仍可继续已有会话。

Skill 引用的脚本和资料放在自己的目录中，并使用相对于该 Skill 目录的路径。修改或新增 Skill 后，新建会话即可使用。
