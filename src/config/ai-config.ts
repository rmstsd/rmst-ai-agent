export const aiConfig = {
  ark: {
    apiKey: 'ark-fee4d2cf-62d6-49e7-9a6c-86e76af4d81b-985ab',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    modelId: 'doubao-seed-2-0-mini-260428',
    timeoutMs: 60_000,
    caching: false
  },
  m4: {
    baseUrl: 'http://localhost:5800',
    appId: 'm4',
    appKey: 'm4',
    timeoutMs: 60_000
  },
  speech: {
    appId: '',
    token: '',
    resourceId: 'volc.bigasr.auc_turbo',
    hotWords: ['密集库', '线边库', '库位', '0']
  }
} as const
