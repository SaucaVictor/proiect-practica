-- ─────────────────────────────────────────────────────────────────────────────
-- NeuralChat — User Resources Migration
-- ─────────────────────────────────────────────────────────────────────────────

-- Create user_resources table
CREATE TABLE IF NOT EXISTS public.user_resources (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id    UUID REFERENCES public.user_resources(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('folder', 'file')),
  file_path    TEXT, -- Null for folders
  size         INTEGER DEFAULT 0, -- Null/0 for folders
  mime_type    TEXT, -- Null for folders
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for speed
CREATE INDEX IF NOT EXISTS idx_user_resources_user_id ON public.user_resources (user_id);
CREATE INDEX IF NOT EXISTS idx_user_resources_parent_id ON public.user_resources (parent_id);

-- Enable RLS
ALTER TABLE public.user_resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own user_resources"
  ON public.user_resources FOR ALL
  USING (auth.uid() = user_id);

-- Create user_resources private storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('user_resources', 'user_resources', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage bucket
CREATE POLICY "Users can upload to their own user_resources folder"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'user_resources' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view their own user_resources files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user_resources' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own user_resources files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'user_resources' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Trigger for updated_at updates
CREATE OR REPLACE TRIGGER set_user_resources_updated_at 
  BEFORE UPDATE ON public.user_resources 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
