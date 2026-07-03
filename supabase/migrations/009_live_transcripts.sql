-- ─────────────────────────────────────────────────────────────────────────────
-- ClassMonitor — Live Transcripts Migration
-- Stores real-time speech-to-text segments produced by WhisperLiveKit.
-- Each row is one transcript segment that arrived during a recording session.
-- Segments are linked to the active schedule slot (NULL = "Unnamed Lecture").
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.live_transcripts (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Link to the active schedule slot (NULL if no matching course at that time)
  schedule_id    UUID        REFERENCES public.schedule(id) ON DELETE SET NULL,

  -- Denormalized subject name for fast reads (avoids JOIN on every Realtime event)
  subject_name   TEXT        NOT NULL DEFAULT 'Unnamed Lecture',

  -- Calendar date of the recording session (UTC date, not timestamp)
  session_date   DATE        NOT NULL DEFAULT CURRENT_DATE,

  -- Wall-clock timestamps of this segment (from the audio server system clock)
  segment_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  segment_end    TIMESTAMPTZ,

  -- The transcribed text for this segment
  text           TEXT        NOT NULL DEFAULT '',

  -- false = preliminary/in-progress (may be updated), true = confirmed final
  is_final       BOOLEAN     NOT NULL DEFAULT FALSE,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for typical query patterns
CREATE INDEX IF NOT EXISTS idx_live_transcripts_session_date
  ON public.live_transcripts (session_date DESC);

CREATE INDEX IF NOT EXISTS idx_live_transcripts_schedule_id
  ON public.live_transcripts (schedule_id, session_date);

CREATE INDEX IF NOT EXISTS idx_live_transcripts_created_at
  ON public.live_transcripts (created_at DESC);

-- Reuse the set_updated_at() function from 001_initial_schema.sql
CREATE OR REPLACE TRIGGER set_live_transcripts_updated_at
  BEFORE UPDATE ON public.live_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Any authenticated user (student / professor) can read transcripts.
-- The audio server inserts/updates using the service role key which bypasses RLS.
-- We also allow anon INSERT so the server can work with the anon key as fallback.

ALTER TABLE public.live_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read live transcripts"
  ON public.live_transcripts FOR SELECT
  USING (auth.role() IN ('authenticated', 'anon'));

-- Server-side inserts: allow anon role to insert (audio server uses anon key)
-- If you have a service role key, this can be restricted to 'authenticated' only.
CREATE POLICY "Allow server to insert live transcripts"
  ON public.live_transcripts FOR INSERT
  WITH CHECK (true);

-- Allow server to update (for finalizing preliminary segments)
CREATE POLICY "Allow server to update live transcripts"
  ON public.live_transcripts FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ─── Realtime ────────────────────────────────────────────────────────────────
-- Enable Supabase Realtime so the frontend can subscribe to new segments
-- without polling.

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_transcripts;
