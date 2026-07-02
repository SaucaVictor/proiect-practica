-- ─────────────────────────────────────────────────────────────────────────────
-- NeuralChat — Update Default Model Migration (GLM 5.1 EOL)
-- Run this in Supabase SQL Editor or via supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Alter settings column default value for new users
ALTER TABLE public.settings 
  ALTER COLUMN default_model SET DEFAULT 'minimaxai/minimax-m3';

-- 2. Update existing settings records using the EOL model
UPDATE public.settings 
  SET default_model = 'minimaxai/minimax-m3' 
  WHERE default_model = 'z-ai/glm-5.1';

-- 3. Update existing conversations using the EOL model to migrate them to the new default
UPDATE public.conversations 
  SET model = 'minimaxai/minimax-m3' 
  WHERE model = 'z-ai/glm-5.1';
