import { aiConfig } from '@/config/ai-config'
import { getM4Capabilities } from '@/server/m4-client'

function requireSpeechConfig() {
  if (!aiConfig.speech.appId || !aiConfig.speech.token) {
    throw new Error('请先在 src/config/ai-config.ts 中填写 speech.appId 和 speech.token')
  }
}

function stripDataUrl(data: string) {
  const commaIndex = data.indexOf(',')
  return data.startsWith('data:audio/') && commaIndex >= 0 ? data.slice(commaIndex + 1) : data
}

export async function recognizeSpeech(data: string) {
  requireSpeechConfig()
  // 合并基础热词、车队业务热词、机器人名和 Node 配置热词。
  const capabilities = await getM4Capabilities()
  const hotWords = [...new Set([...capabilities.hotWords, ...aiConfig.speech.hotWords])]
  const context = JSON.stringify({
    hotwords: hotWords.map(word => ({ word }))
  })

  /**
   * 一次语音到文本。
   * data 为 Base64 编码音频内容，也支持完整的音频 Data URL。
   */
  const response = await fetch('https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Api-App-Key': aiConfig.speech.appId,
      'X-Api-Access-Key': aiConfig.speech.token,
      'X-Api-Resource-Id': aiConfig.speech.resourceId,
      'X-Api-Request-Id': crypto.randomUUID(),
      'X-Api-Sequence': '-1'
    },
    body: JSON.stringify({
      user: { uid: aiConfig.speech.appId },
      audio: { data: stripDataUrl(data) },
      request: {
        model_name: 'bigmodel',
        corpus: { context }
      }
    })
  })

  if (!response.ok) {
    throw new Error(`语音识别请求失败（${response.status}）：${await response.text()}`)
  }

  const statusCode = response.headers.get('X-Api-Status-Code')
  if (statusCode === '20000003') throw new Error('未检测到有效语音')
  if (statusCode === '55000031') throw new Error('语音识别服务繁忙')
  if (statusCode !== '20000000') throw new Error(`语音识别失败：${statusCode ?? '未知状态'}`)

  const result = (await response.json()) as { result?: { text?: string } }
  return result.result?.text ?? ''
}
