import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './client'
import type { Message, Conversation } from '@/types'

// ─── Mapping Helpers ──────────────────────────────────────────────────────────

function mapRealtimeConversation(row: any): Partial<Conversation> {
  const mapped: any = {}
  if (row.id !== undefined) mapped.id = row.id
  if (row.user_id !== undefined) mapped.userId = row.user_id
  if (row.workspace_id !== undefined) mapped.workspaceId = row.workspace_id
  if (row.title !== undefined) mapped.title = row.title
  if (row.model !== undefined) mapped.model = row.model
  if (row.provider !== undefined) mapped.provider = row.provider
  if (row.pinned !== undefined) mapped.pinned = row.pinned
  if (row.archived !== undefined) mapped.archived = row.archived
  if (row.message_count !== undefined) mapped.messageCount = row.message_count
  if (row.last_message_at !== undefined) mapped.lastMessageAt = row.last_message_at
  if (row.created_at !== undefined) mapped.createdAt = row.created_at
  if (row.updated_at !== undefined) mapped.updatedAt = row.updated_at
  return mapped
}

function mapRealtimeMessage(row: any): Partial<Message> {
  const mapped: any = {}
  if (row.id !== undefined) mapped.id = row.id
  if (row.conversation_id !== undefined) mapped.conversationId = row.conversation_id
  if (row.role !== undefined) mapped.role = row.role
  if (row.content !== undefined) mapped.content = row.content
  if (row.reasoning !== undefined) mapped.reasoning = row.reasoning
  if (row.metadata !== undefined) mapped.metadata = row.metadata
  if (row.created_at !== undefined) mapped.createdAt = row.created_at
  if (row.updated_at !== undefined) mapped.updatedAt = row.updated_at
  return mapped
}

// ─── Conversation realtime ────────────────────────────────────────────────────

export function subscribeToConversations(
  userId: string,
  callbacks: {
    onInsert?: (conversation: Partial<Conversation>) => void
    onUpdate?: (conversation: Partial<Conversation>) => void
    onDelete?: (id: string) => void
  }
): RealtimeChannel {
  const channel = supabase
    .channel(`conversations:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
        filter: `user_id=eq.${userId}`,
      },
      payload => callbacks.onInsert?.(mapRealtimeConversation(payload.new))
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `user_id=eq.${userId}`,
      },
      payload => callbacks.onUpdate?.(mapRealtimeConversation(payload.new))
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'conversations',
        filter: `user_id=eq.${userId}`,
      },
      payload => callbacks.onDelete?.((payload.old as { id: string }).id)
    )
    .subscribe()

  return channel
}

// ─── Messages realtime ────────────────────────────────────────────────────────

export function subscribeToMessages(
  conversationId: string,
  callbacks: {
    onInsert?: (message: Partial<Message>) => void
    onUpdate?: (message: Partial<Message>) => void
    onDelete?: (id: string) => void
  }
): RealtimeChannel {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      payload => callbacks.onInsert?.(mapRealtimeMessage(payload.new))
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      payload => callbacks.onUpdate?.(mapRealtimeMessage(payload.new))
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      payload => callbacks.onDelete?.((payload.old as { id: string }).id)
    )
    .subscribe()

  return channel
}

export function unsubscribe(channel: RealtimeChannel): void {
  void supabase.removeChannel(channel)
}
