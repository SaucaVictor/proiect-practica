// ─── Database row types (mirrors Supabase schema) ───────────────────────────

export interface DbProfile {
  id: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface DbWorkspace {
  id: string
  owner_id: string
  name: string
  settings: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface DbConversation {
  id: string
  user_id: string
  workspace_id: string | null
  title: string
  model: string
  provider: string
  pinned: boolean
  archived: boolean
  message_count: number
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export interface DbMessage {
  id: string
  conversation_id: string
  role: string
  content: string
  reasoning: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface DbAttachment {
  id: string
  message_id: string
  storage_path: string
  mime_type: string
  name: string
  size: number
  created_at: string
}

export interface DbSettings {
  user_id: string
  theme: string
  accent_color: string
  font_size: string
  compact_mode: boolean
  default_provider: string
  default_model: string
  system_prompt: string
  temperature: number
  top_p: number
  top_k: number
  max_tokens: number
  presence_penalty: number
  frequency_penalty: number
  stream_enabled: boolean
  send_on_enter: boolean
  show_timestamps: boolean
  show_token_count: boolean
  open_resources_on_new_chat: boolean
  updated_at: string
}

export interface DbProvider {
  id: string
  user_id: string
  name: string
  display_name: string
  base_url: string
  api_key: string | null
  enabled: boolean
  created_at: string
}

export interface DbFavorite {
  user_id: string
  message_id: string
  created_at: string
}

export interface DbScheduleEntry {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  subject_name: string
  created_at: string
  updated_at: string
}
