export type UiMessage = {
  id?: string
  type: 'ai' | 'user' | 'tool'
  content?: string

  toolCalls?: { id: string; name: string; args: string }[]
  error?: unknown
}
