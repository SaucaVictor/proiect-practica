import type { UserSettings } from '@/types'
import type { DbSettings } from '@/types/database'
import { DEFAULT_SETTINGS } from '@/types'
import { supabase } from './client'

// ─── Mapping ─────────────────────────────────────────────────────────────────

function mapSettings(row: DbSettings): UserSettings {
  return {
    userId: row.user_id,
    theme: row.theme as UserSettings['theme'],
    accentColor: row.accent_color as UserSettings['accentColor'],
    fontSize: row.font_size as UserSettings['fontSize'],
    compactMode: row.compact_mode,
    defaultProvider: row.default_provider as UserSettings['defaultProvider'],
    defaultModel: row.default_model,
    systemPrompt: row.system_prompt,
    temperature: Number(row.temperature),
    topP: Number(row.top_p),
    topK: row.top_k,
    maxTokens: row.max_tokens,
    presencePenalty: Number(row.presence_penalty),
    frequencyPenalty: Number(row.frequency_penalty),
    streamEnabled: row.stream_enabled,
    sendOnEnter: row.send_on_enter,
    showTimestamps: row.show_timestamps,
    showTokenCount: row.show_token_count,
    updatedAt: row.updated_at,
  }
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function getSettings(): Promise<UserSettings | null> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return null

  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userData.user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return mapSettings(data as DbSettings)
}

export async function saveSettings(settings: Partial<Omit<UserSettings, 'userId' | 'updatedAt'>>): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not authenticated')

  const dbUpdates: Partial<DbSettings> = {}
  if (settings.theme !== undefined)             dbUpdates.theme              = settings.theme
  if (settings.accentColor !== undefined)       dbUpdates.accent_color       = settings.accentColor
  if (settings.fontSize !== undefined)          dbUpdates.font_size          = settings.fontSize
  if (settings.compactMode !== undefined)       dbUpdates.compact_mode       = settings.compactMode
  if (settings.defaultProvider !== undefined)   dbUpdates.default_provider   = settings.defaultProvider
  if (settings.defaultModel !== undefined)      dbUpdates.default_model      = settings.defaultModel
  if (settings.systemPrompt !== undefined)      dbUpdates.system_prompt      = settings.systemPrompt
  if (settings.temperature !== undefined)       dbUpdates.temperature        = settings.temperature
  if (settings.topP !== undefined)              dbUpdates.top_p              = settings.topP
  if (settings.topK !== undefined)              dbUpdates.top_k              = settings.topK
  if (settings.maxTokens !== undefined)         dbUpdates.max_tokens         = settings.maxTokens
  if (settings.presencePenalty !== undefined)   dbUpdates.presence_penalty   = settings.presencePenalty
  if (settings.frequencyPenalty !== undefined)  dbUpdates.frequency_penalty  = settings.frequencyPenalty
  if (settings.streamEnabled !== undefined)     dbUpdates.stream_enabled     = settings.streamEnabled
  if (settings.sendOnEnter !== undefined)       dbUpdates.send_on_enter      = settings.sendOnEnter
  if (settings.showTimestamps !== undefined)    dbUpdates.show_timestamps    = settings.showTimestamps
  if (settings.showTokenCount !== undefined)    dbUpdates.show_token_count   = settings.showTokenCount

  const { error } = await supabase
    .from('settings')
    .upsert({ user_id: userData.user.id, ...dbUpdates })

  if (error) throw error
}

export function getDefaultSettings(userId: string): UserSettings {
  return {
    ...DEFAULT_SETTINGS,
    userId,
    updatedAt: new Date().toISOString(),
  }
}
