export type MessageRole = 'user' | 'assistant' | 'system' | 'tool' | 'reasoning' | 'error' | 'status'

export type MessageStatus = 'sending' | 'streaming' | 'done' | 'error' | 'aborted'

export interface Attachment {
  id: string
  messageId: string
  storagePath: string
  mimeType: string
  name: string
  size: number
  url?: string
}

export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  reasoning?: string
  status: MessageStatus
  attachments?: Attachment[]
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt?: string
  // Optimistic flag — set before server confirm
  optimistic?: boolean
}

export interface Conversation {
  id: string
  userId: string
  workspaceId?: string
  title: string
  model: string
  provider: string
  pinned: boolean
  archived: boolean
  messageCount: number
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ConversationFilters {
  search?: string
  archived?: boolean
  pinned?: boolean
}

export type ConversationGroup = 'pinned' | 'today' | 'yesterday' | 'last7days' | 'last30days' | 'older' | 'archived'

export interface GroupedConversations {
  group: ConversationGroup
  label: string
  conversations: Conversation[]
}
