export const aiConfig = {
  ark: {
    apiKey: '10b6a901-d4ba-4482-9ae9-f3bd77160ff8',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    modelId: 'doubao-seed-evolving',
    timeoutMs: 60_000,
    caching: true
  },
  speech: {
    appId: '',
    token: '',
    resourceId: 'volc.bigasr.auc_turbo',
    hotWords: ['密集库', '线边库', '库位', '0']
  }
} as const
