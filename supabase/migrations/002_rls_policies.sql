-- ─────────────────────────────────────────────────────────────────────────────
-- NeuralChat — Row Level Security Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinned_conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites             ENABLE ROW LEVEL SECURITY;

-- ─── Profiles ───────────────────────────────────────────────────────────────

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ─── Workspaces ──────────────────────────────────────────────────────────────

CREATE POLICY "Users can manage their own workspaces"
  ON public.workspaces FOR ALL USING (auth.uid() = owner_id);

-- ─── Settings ────────────────────────────────────────────────────────────────

CREATE POLICY "Users can manage their own settings"
  ON public.settings FOR ALL USING (auth.uid() = user_id);

-- ─── Conversations ───────────────────────────────────────────────────────────

CREATE POLICY "Users can manage their own conversations"
  ON public.conversations FOR ALL USING (auth.uid() = user_id);

-- ─── Messages ────────────────────────────────────────────────────────────────

-- Messages belong to conversations which belong to users
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages in their conversations"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages in their conversations"
  ON public.messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

-- ─── Attachments ─────────────────────────────────────────────────────────────

CREATE POLICY "Users can manage attachments on their messages"
  ON public.attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_id AND c.user_id = auth.uid()
    )
  );

-- ─── Providers ───────────────────────────────────────────────────────────────

CREATE POLICY "Users can manage their own providers"
  ON public.providers FOR ALL USING (auth.uid() = user_id);

-- ─── Pinned Conversations ────────────────────────────────────────────────────

CREATE POLICY "Users can manage their own pinned conversations"
  ON public.pinned_conversations FOR ALL USING (auth.uid() = user_id);

-- ─── Favorites ───────────────────────────────────────────────────────────────

CREATE POLICY "Users can manage their own favorites"
  ON public.favorites FOR ALL USING (auth.uid() = user_id);

-- ─── Storage Bucket ──────────────────────────────────────────────────────────

-- Run this after creating the 'attachments' bucket in Supabase Storage dashboard
-- INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false);

CREATE POLICY "Users can upload to their own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
