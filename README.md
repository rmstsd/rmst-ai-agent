# rmst-ai-agent

这是将 M4 后端 `AiHandler.kt` 的 AI 对话逻辑重构为 Next.js 的个人学习项目，包含：

- Ark Responses API 会话初始化和上下文串联
- SSE 流式对话、停止生成和函数调用闭环
- 火山引擎录音转文字
- Next.js Route Handlers 后端与 React 聊天界面
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

访问 `http://localhost:3000`。

## API

- `POST /api/ai/session`：初始化会话
- `POST /api/ai/chat`：发送消息并返回 SSE
- `POST /api/ai/call-function`：执行函数结果后的续写
- `POST /api/ai/stop`：停止当前生成
- `POST /api/ai/speech-recognize`：一次性语音识别

浏览器端所有通信封装在 `src/api/ai-api.ts`，没有使用 Server Actions。
