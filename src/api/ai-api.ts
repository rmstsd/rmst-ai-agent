import type { ApprovalDecision, ChatMessage, ChatStreamEvent, PendingApproval } from '@/types/ai'

async function readError(response: Response) {
  const result = (await response.json().catch(() => null)) as { message?: string } | null
  return result?.message ?? `请求失败（${response.status}）`
}

export async function initSession() {
  const response = await fetch('/api/ai/session', { method: 'POST' })
  if (!response.ok) throw new Error(await readError(response))
  const result = (await response.json()) as { sessionId: string }
  return result.sessionId
}

export async function getSession(sessionId: string) {
  const response = await fetch(`/api/ai/session/${encodeURIComponent(sessionId)}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(await readError(response))
  return (await response.json()) as {
    sessionId: string
    createdAt: number
    messages: ChatMessage[]
    pendingApproval?: PendingApproval
  }
}

async function consumeSse(response: Response, onEvent: (event: ChatStreamEvent) => void) {
  if (!response.ok) throw new Error(await readError(response))
  if (!response.body) throw new Error('服务端没有返回消息流')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done }).replaceAll('\r\n', '\n')
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''

    for (const block of blocks) {
      const data = block.split('\n').find(line => line.startsWith('data:'))?.slice(5).trim()
      if (data) onEvent(JSON.parse(data) as ChatStreamEvent)
    }

    if (done) break
  }
}

export async function sendMessage(sessionId: string, message: string, onEvent: (event: ChatStreamEvent) => void) {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message })
  })

  await consumeSse(response, onEvent)
}

export async function sendApproval(
  sessionId: string,
  decisions: ApprovalDecision[],
  onEvent: (event: ChatStreamEvent) => void
) {
  const response = await fetch('/api/ai/approval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, decisions })
  })

  await consumeSse(response, onEvent)
}

export async function stopMessage(sessionId: string) {
  const response = await fetch('/api/ai/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  })
  if (!response.ok) throw new Error(await readError(response))
}
