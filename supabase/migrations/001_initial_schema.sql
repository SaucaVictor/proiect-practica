-- ─────────────────────────────────────────────────────────────────────────────
-- NeuralChat — Initial Schema Migration
-- Run this in Supabase SQL Editor or via supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Profiles ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Workspaces ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workspaces (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'My Workspace',
  settings   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Settings ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.settings (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme             TEXT NOT NULL DEFAULT 'dark',
  accent_color      TEXT NOT NULL DEFAULT 'indigo',
  font_size         TEXT NOT NULL DEFAULT 'md',
  compact_mode      BOOLEAN NOT NULL DEFAULT FALSE,
  default_provider  TEXT NOT NULL DEFAULT 'nvidia',
  default_model     TEXT NOT NULL DEFAULT 'meta/llama-3.1-70b-instruct',
  system_prompt     TEXT NOT NULL DEFAULT '',
  temperature       NUMERIC(4,3) NOT NULL DEFAULT 0.700,
  top_p             NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  top_k             INTEGER NOT NULL DEFAULT 0,
  max_tokens        INTEGER NOT NULL DEFAULT 2048,
  presence_penalty  NUMERIC(4,3) NOT NULL DEFAULT 0.000,
  frequency_penalty NUMERIC(4,3) NOT NULL DEFAULT 0.000,
  stream_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  send_on_enter     BOOLEAN NOT NULL DEFAULT TRUE,
  show_timestamps   BOOLEAN NOT NULL DEFAULT TRUE,
  show_token_count  BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Conversations ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id    UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  title           TEXT NOT NULL DEFAULT 'New conversation',
  model           TEXT NOT NULL DEFAULT 'meta/llama-3.1-70b-instruct',
  provider        TEXT NOT NULL DEFAULT 'nvidia',
  pinned          BOOLEAN NOT NULL DEFAULT FALSE,
  archived        BOOLEAN NOT NULL DEFAULT FALSE,
  message_count   INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_pinned ON public.conversations (user_id, pinned) WHERE pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON public.conversations (user_id, archived);

-- ─── Messages ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool', 'reasoning', 'error', 'status')),
  content         TEXT NOT NULL DEFAULT '',
  reasoning       TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id, created_at);

-- Auto-update conversation stats on new message
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.conversations
  SET
    message_count   = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at      = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_message_created
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();

-- ─── Attachments ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attachments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id   UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  name         TEXT NOT NULL,
  size         INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON public.attachments (message_id);

-- ─── Providers (user-configured) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.providers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  display_name TEXT NOT NULL,
  base_url     TEXT NOT NULL,
  api_key      TEXT,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

-- ─── Pinned Conversations ────────────────────────────────────────────────────

-- Pinned is stored directly on conversation, this table is for future multi-workspace pinning
-- Keeping it for schema completeness and future use.
CREATE TABLE IF NOT EXISTS public.pinned_conversations (
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, conversation_id)
);

-- ─── Favorites (starred messages) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.favorites (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, message_id)
);

-- ─── Updated-at triggers helper ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER set_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER set_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER set_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER set_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
