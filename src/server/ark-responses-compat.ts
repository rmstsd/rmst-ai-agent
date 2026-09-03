import { aiConfig } from '@/config/ai-config'
import { ChatOpenAI } from '@langchain/openai'

export function requireArkConfig() {
  if (!aiConfig.ark.apiKey || !aiConfig.ark.modelId || !aiConfig.ark.baseUrl) {
    throw new Error('请先在 src/config/ai-config.ts 中填写 Ark 配置')
  }
}

export function createArkModel() {
  const model = new ChatOpenAI({
    apiKey: aiConfig.ark.apiKey,
    model: aiConfig.ark.modelId,
    streaming: true,
    useResponsesApi: true,
    timeout: aiConfig.ark.timeoutMs,
    configuration: {
      baseURL: aiConfig.ark.baseUrl
    },
    modelKwargs: {
      store: aiConfig.ark.store
    }
  })

  return model
}
