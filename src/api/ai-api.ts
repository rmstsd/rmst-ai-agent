import type { UIMessage } from 'ai'

async function readError(response: Response) {
  const result = (await response.json().catch(() => null)) as { message?: string } | null
  return result?.message ?? `请求失败（${response.status}）`
}

export interface AiSessionSummary {
  id: string
  title: string
  messageCount: number
  updatedAt: number
}

export type AiSessionMessage = UIMessage

export async function initSession() {
  const response = await fetch('/api/ai/session', { method: 'POST' })
  if (!response.ok) throw new Error(await readError(response))
  const result = (await response.json()) as { sessionId: string }
  return result.sessionId
}

export async function getSessions() {
  const response = await fetch('/api/ai/session')
  if (!response.ok) throw new Error(await readError(response))
  const result = (await response.json()) as { sessions: AiSessionSummary[] }
  return result.sessions
}

export async function getSessionMessages(sessionId: string) {
  const response = await fetch(`/api/ai/session/${sessionId}`)
  if (!response.ok) throw new Error(await readError(response))
  const result = (await response.json()) as { id: string; messages: AiSessionMessage[] }
  return result.messages
}

export async function stopMessage(sessionId: string) {
  // 是否停止对话：服务端会取消当前会话正在进行的请求。
  const response = await fetch('/api/ai/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  })
  if (!response.ok) throw new Error(await readError(response))
}

export async function recognizeSpeech(data: string) {
  // data 为 Base64 编码音频内容。
  const response = await fetch('/api/ai/speech-recognize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  })
  if (!response.ok) throw new Error(await readError(response))
  const result = (await response.json()) as { text: string }
  return result.text
}
