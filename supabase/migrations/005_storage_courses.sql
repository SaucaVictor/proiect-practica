-- ─────────────────────────────────────────────────────────────────────────────
-- NeuralChat — Courses Storage Bucket Migration
-- ─────────────────────────────────────────────────────────────────────────────

-- Create courses bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('courses', 'courses', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for 'courses' bucket
-- Allow all operations for convenience in the demo/practica environment
CREATE POLICY "Allow all public operations on courses bucket"
ON storage.objects FOR ALL
USING (bucket_id = 'courses')
WITH CHECK (bucket_id = 'courses');
