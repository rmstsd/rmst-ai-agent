export const aiConfig = {
  ark: {
    apiKey: 'ark-fee4d2cf-62d6-49e7-9a6c-86e76af4d81b-985ab',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    modelId: 'deepseek-v4-flash-ga-260731',
    timeoutMs: 10 * 60_000,
    caching: false
  },
  m4: {
    baseUrl: 'http://localhost:5800',
    appId: 'm4',
    appKey: 'm4',
    timeoutMs: 60_000
  }
} as const
