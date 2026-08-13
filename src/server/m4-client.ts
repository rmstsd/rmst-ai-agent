import { aiConfig } from '@/config/ai-config'

export interface M4ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface M4Capabilities {
  systemPrompts: string[]
  tools: M4ToolDefinition[]
  hotWords: string[]
}

function requireM4Config() {
  if (!aiConfig.m4.baseUrl || !aiConfig.m4.appId || !aiConfig.m4.appKey) {
    throw new Error('请先在 src/config/ai-config.ts 中填写 M4 baseUrl、appId 和 appKey')
  }
}

async function m4Fetch(path: string, init?: RequestInit) {
  requireM4Config()
  const response = await fetch(`${aiConfig.m4.baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'xyy-app-id': aiConfig.m4.appId,
      'xyy-app-key': aiConfig.m4.appKey,
      ...init?.headers
    },
    signal: AbortSignal.timeout(aiConfig.m4.timeoutMs)
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`M4 请求失败（${response.status}）：${detail || response.statusText}`)
  }

  return response
}

/**
 * 获取 ArkManager 当前注册的全部系统提示词和工具。
 * 其中包括 FleetAiArkManager、StoreAi 和 LogAi 在模块初始化阶段注册的能力。
 */
export async function getM4Capabilities() {
  const response = await m4Fetch('/api/ai/tools', { cache: 'no-store' })
  return (await response.json()) as M4Capabilities
}

/**
 * 在 M4 进程中执行工具，复用场景、机器人、运单、库存和日志运行时。
 */
export async function executeM4Tool(name: string, args?: string) {
  const response = await m4Fetch('/api/ai/tools/call', {
    method: 'POST',
    body: JSON.stringify({ name, args })
  })
  const result = (await response.json()) as { output: string }
  return result.output
}
