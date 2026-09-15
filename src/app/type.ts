export type ToolStatus = 'pending' | 'rmst_approval_required' | 'running' | 'success' | 'error'

export type UiToolCall = {
  id: string
  name: string
  args: unknown
  status?: ToolStatus
  content?: string
  error?: unknown
}

export type UiMessage = {
  id: string
  type: 'ai' | 'user' | 'tool'
  content?: string
  toolCalls?: UiToolCall[]
}

export type ChatListResponse = {
  messages: UiMessage[]
  needApproval: boolean
}

export type ChatStreamEvent =
  | { type: 'thread'; threadId: string }
  | { type: 'ai'; id: string; content: unknown }
  | { type: 'tool_calls'; id: string; toolCalls: UiToolCall[] }
  | { type: 'rmst_approval_required'; id: string; toolCalls: UiToolCall[] }
  | { type: 'tool_start'; id: string }
  | { type: 'tool_end'; id: string; name: string; output: unknown }
  | { type: 'tool_error'; id: string; name: string; error: unknown }
  | { type: 'done' }
  | { type: 'error'; error: unknown }
