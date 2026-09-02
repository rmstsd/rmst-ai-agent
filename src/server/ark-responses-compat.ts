import { aiConfig } from '@/config/ai-config'
import { ChatOpenAI } from '@langchain/openai'

export function requireArkConfig() {
  if (!aiConfig.ark.apiKey || !aiConfig.ark.modelId || !aiConfig.ark.baseUrl) {
    throw new Error('请先在 src/config/ai-config.ts 中填写 Ark 配置')
  }
}

function normalizeArkResponsePayload(value: unknown) {
  if (!value || typeof value !== 'object') return value
  const payload = value as { output?: unknown }
  if (!Array.isArray(payload.output)) return value

  return {
    ...payload,
    output: payload.output.map(item => {
      if (!item || typeof item !== 'object') return item
      const outputItem = item as { type?: unknown; content?: unknown }
      if (outputItem.type !== 'message' || !Array.isArray(outputItem.content)) return item

      return {
        ...outputItem,
        content: outputItem.content.map(part => {
          if (!part || typeof part !== 'object') return part
          const contentPart = part as { type?: unknown; annotations?: unknown }
          if (contentPart.type !== 'output_text' || Array.isArray(contentPart.annotations)) return part
          return { ...contentPart, annotations: [] }
        })
      }
    })
  }
}

function normalizeArkResponseEvent(value: unknown) {
  if (!value || typeof value !== 'object') return value
  const event = value as { response?: unknown }
  if (!event.response || typeof event.response !== 'object') return normalizeArkResponsePayload(value)
  return { ...event, response: normalizeArkResponsePayload(event.response) }
}

function patchArkResponsesModel(chatModel: ChatOpenAI) {
  const responsesModel = (
    chatModel as unknown as {
      responses: {
        completionWithRetry: (...args: unknown[]) => Promise<unknown>
        __arkResponseCompatibilityPatched?: boolean
      }
    }
  ).responses
  if (responsesModel.__arkResponseCompatibilityPatched) return
  responsesModel.__arkResponseCompatibilityPatched = true

  const originalCompletionWithRetry = responsesModel.completionWithRetry.bind(responsesModel)

  responsesModel.completionWithRetry = async (...args: unknown[]) => {
    const result = await originalCompletionWithRetry(...args)
    const request = args[0]
    if (request && typeof request === 'object' && (request as { stream?: unknown }).stream === true) {
      return (async function* () {
        for await (const event of result as AsyncIterable<unknown>) {
          yield normalizeArkResponseEvent(event)
        }
      })()
    }
    return normalizeArkResponseEvent(result)
  }
}

function patchArkWithConfigCompatibility() {
  const chatOpenAIPrototype = ChatOpenAI.prototype as unknown as {
    withConfig: (this: ChatOpenAI, config: Record<string, unknown>) => ChatOpenAI
    __arkWithConfigCompatibilityPatched?: boolean
  }

  if (chatOpenAIPrototype.__arkWithConfigCompatibilityPatched) return
  const originalWithConfig = chatOpenAIPrototype.withConfig
  chatOpenAIPrototype.withConfig = function (this: ChatOpenAI, config: Record<string, unknown>) {
    const configuredModel = originalWithConfig.call(this, config)
    patchArkResponsesModel(configuredModel)
    return configuredModel
  }
  chatOpenAIPrototype.__arkWithConfigCompatibilityPatched = true
}

export function createArkModel() {
  // patchArkWithConfigCompatibility()

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

  // patchArkResponsesModel(model)
  return model
}
