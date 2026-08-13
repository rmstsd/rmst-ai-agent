export interface AiToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export const emptyParameters = {}

export function objectParameters(
  properties: Record<string, Record<string, unknown>>,
  required: string[] = []
) {
  return {
    type: 'object',
    properties,
    required
  }
}

export const stringProperty = (description: string) => ({ type: 'string', description })

export const booleanProperty = (description: string) => ({ type: 'boolean', description })

export const arrayProperty = (description: string) => ({
  type: 'array',
  description
})
