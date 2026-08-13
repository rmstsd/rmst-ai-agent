export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  status?: 'streaming' | 'done' | 'error'
}

export type ChatStreamEvent =
  | { type: 'Text'; text: string }
  | { type: 'Done'; responseId?: string }
  | { type: 'Error'; code?: string; message: string }
  | { type: 'Function'; name: string; args?: string; callId: string }
