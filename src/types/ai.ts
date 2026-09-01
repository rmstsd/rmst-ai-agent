import type { StoredMessage } from '@langchain/core/messages'

export type ChatRole = 'user' | 'assistant'

export interface ChatToolCall {
  id: string
  name: string
  args?: string
  output?: string
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  reasoning?: string
  toolCalls?: ChatToolCall[]
  createdAt: number
  status?: 'streaming' | 'done' | 'error'
}

export type LangChainHistoryMessage = StoredMessage & {
  data: StoredMessage['data'] & Record<string, unknown>
}

export type ApprovalDecisionType = 'approve' | 'edit' | 'reject' | 'respond'

export interface ApprovalDecision {
  type: ApprovalDecisionType
  message?: string
  editedAction?: {
    name: string
    args: Record<string, unknown>
  }
}

export interface ApprovalRequest {
  id: string
  name: string
  args: unknown
  description?: string
  allowedDecisions: ApprovalDecisionType[]
}

export interface PendingApproval {
  requests: ApprovalRequest[]
}

export type ChatStreamEvent =
  | { type: 'Text'; text: string }
  | { type: 'Reasoning'; text: string }
  | { type: 'Done'; responseId?: string; interrupted?: boolean }
  | { type: 'Error'; code?: string; message: string }
  | { type: 'Function'; name: string; args?: string; callId: string }
  | { type: 'FunctionResult'; name: string; output?: string; callId: string }
  | { type: 'Approval'; approval: PendingApproval }
