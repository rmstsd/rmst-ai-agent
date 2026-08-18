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
