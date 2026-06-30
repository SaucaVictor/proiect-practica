import type { Message, MessageRole } from '@/types'
import type { DbMessage } from '@/types/database'
import { supabase } from './client'

const PAGE_SIZE = 50

// ─── Mapping ─────────────────────────────────────────────────────────────────

function mapMessage(row: DbMessage): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as MessageRole,
    content: row.content,
    reasoning: row.reasoning ?? undefined,
    status: 'done',
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function listMessages(
  conversationId: string,
  page = 0
): Promise<Message[]> {
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, error } = await supabase
    .from('messages')
    .select('*, attachments(*)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .range(from, to)

  if (error) throw error

  const messages = await Promise.all(
    (data ?? []).map(async (row: any) => {
      const msg = mapMessage(row)
      if (row.attachments && row.attachments.length > 0) {
        const mappedAttachments = await Promise.all(
          row.attachments.map(async (att: any) => {
            let url = ''
            try {
              const { getAttachmentUrl } = await import('./attachments')
              url = await getAttachmentUrl(att.storage_path)
            } catch (err) {
              console.error('Failed to get attachment URL', err)
            }
            return {
              id: att.id,
              messageId: att.message_id,
              storagePath: att.storage_path,
              mimeType: att.mime_type,
              name: att.name,
              size: att.size,
              url,
            }
          })
        )
        msg.attachments = mappedAttachments
      }
      return msg
    })
  )

  return messages
}

export async function createMessage(payload: {
  conversationId: string
  role: MessageRole
  content: string
  reasoning?: string
  metadata?: Record<string, unknown>
}): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: payload.conversationId,
      role: payload.role,
      content: payload.content,
      reasoning: payload.reasoning ?? null,
      metadata: payload.metadata ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return mapMessage(data as DbMessage)
}

export async function updateMessage(
  id: string,
  updates: Partial<{ content: string; reasoning: string }>
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update(updates)
    .eq('id', id)

  if (error) throw error
}

export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase.from('messages').delete().eq('id', id)
  if (error) throw error
}

export async function deleteMessagesFromIndex(
  conversationId: string,
  fromTimestamp: string
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId)
    .gte('created_at', fromTimestamp)

  if (error) throw error
}
