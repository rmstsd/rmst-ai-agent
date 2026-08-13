interface AiTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (args?: string) => Promise<string>
}

function formatDateTime(date: Date) {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  return formatter.format(date).replaceAll('/', '-')
}

const tools: AiTool[] = [
  {
    name: 'getCurrentDateTime',
    description: '获取当前日期时间',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute: async () => formatDateTime(new Date())
  }
]

export const arkTools = tools.map(({ name, description, parameters }) => ({
  type: 'function',
  name,
  description,
  parameters,
  strict: true
}))

export async function executeTool(name: string, args?: string) {
  const tool = tools.find(item => item.name === name)
  if (!tool) {
    return `Failed to call function, error is Function ${name} not found`
  }

  try {
    return await tool.execute(args)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return `Failed to call function, error is ${message}`
  }
}
