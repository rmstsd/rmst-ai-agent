export type UiMessage = {
  id: string
  type: 'ai' | 'user' | 'tool'
  content: string

  tool_calls?: { id: string; name: string; args: string }[]
  tool_call_id?: string
  name?: string
  args?: string
  status?: 'pending' | 'running' | 'success' | 'error'
  input?: unknown
  error?: unknown
}
