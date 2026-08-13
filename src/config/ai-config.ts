export const aiConfig = {
  ark: {
    apiKey: "",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    modelId: "",
    timeoutMs: 60_000,
    caching: true,
  },
  speech: {
    appId: "",
    token: "",
    resourceId: "volc.bigasr.auc_turbo",
    hotWords: ["密集库", "线边库", "库位", "0"],
  },
} as const;
