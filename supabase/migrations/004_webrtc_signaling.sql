-- ─────────────────────────────────────────────────────────────────────────────
-- NeuralChat — WebRTC Signaling Schema Migration
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.webrtc_signaling (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  TEXT NOT NULL,
  sender      TEXT NOT NULL CHECK (sender IN ('client', 'server')),
  type        TEXT NOT NULL CHECK (type IN ('offer', 'answer')),
  sdp         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick queries by session_id
CREATE INDEX IF NOT EXISTS idx_webrtc_signaling_session_id ON public.webrtc_signaling (session_id);

-- Enable RLS
ALTER TABLE public.webrtc_signaling ENABLE ROW LEVEL SECURITY;

-- Setup RLS policies (Allow all read/write operations for convenience in the practicing environment)
CREATE POLICY "Allow all public operations on webrtc_signaling" ON public.webrtc_signaling FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.webrtc_signaling;
