-- ─────────────────────────────────────────────────────────────────────────────
-- ClassMonitor — Schedule (Orar) Migration
-- Defines the weekly schedule so the audio server knows which subject folder
-- to use when saving recordings and transcripts.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schedule (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  subject_name TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT schedule_time_order CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_schedule_day ON public.schedule (day_of_week, start_time);

-- Reuse the set_updated_at() function from 001_initial_schema.sql
CREATE OR REPLACE TRIGGER set_schedule_updated_at
  BEFORE UPDATE ON public.schedule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Single-classroom project: any authenticated user can read the schedule,
-- any authenticated user can manage entries (insert/update/delete).

ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read schedule"
  ON public.schedule FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert schedule entries"
  ON public.schedule FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update schedule entries"
  ON public.schedule FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete schedule entries"
  ON public.schedule FOR DELETE
  USING (auth.role() = 'authenticated');
