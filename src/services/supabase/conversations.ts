import type { Conversation, ConversationFilters } from '@/types'
import type { DbConversation } from '@/types/database'
import { supabase } from './client'

// ─── Mapping ─────────────────────────────────────────────────────────────────

function mapConversation(row: DbConversation): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id ?? undefined,
    title: row.title,
    model: row.model,
    provider: row.provider,
    pinned: row.pinned,
    archived: row.archived,
    messageCount: row.message_count,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function listConversations(filters: ConversationFilters = {}): Promise<Conversation[]> {
  let query = supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false })

  if (filters.archived !== undefined) {
    query = query.eq('archived', filters.archived)
  } else {
    query = query.eq('archived', false)
  }

  if (filters.pinned !== undefined) {
    query = query.eq('pinned', filters.pinned)
  }

  if (filters.search) {
    query = query.ilike('title', `%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapConversation)
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return mapConversation(data as DbConversation)
}

export async function createConversation(payload: {
  title?: string
  model: string
  provider: string
}): Promise<Conversation> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userData.user.id,
      title: payload.title ?? 'New conversation',
      model: payload.model,
      provider: payload.provider,
    })
    .select()
    .single()

  if (error) throw error
  return mapConversation(data as DbConversation)
}

export async function updateConversation(
  id: string,
  updates: Partial<Pick<Conversation, 'title' | 'model' | 'provider' | 'pinned' | 'archived'>>
): Promise<void> {
  const dbUpdates: Partial<DbConversation> = {}
  if (updates.title !== undefined)    dbUpdates.title    = updates.title
  if (updates.model !== undefined)    dbUpdates.model    = updates.model
  if (updates.provider !== undefined) dbUpdates.provider = updates.provider
  if (updates.pinned !== undefined)   dbUpdates.pinned   = updates.pinned
  if (updates.archived !== undefined) dbUpdates.archived = updates.archived

  const { error } = await supabase
    .from('conversations')
    .update(dbUpdates)
    .eq('id', id)

  if (error) throw error
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('conversations').delete().eq('id', id)
  if (error) throw error
}

export async function archiveConversation(id: string): Promise<void> {
  return updateConversation(id, { archived: true })
}

export async function pinConversation(id: string, pinned: boolean): Promise<void> {
  return updateConversation(id, { pinned })
}
